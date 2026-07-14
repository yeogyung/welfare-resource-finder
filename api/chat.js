const DEFAULT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const DAILY_LIMIT = Number(process.env.OPENAI_CHAT_DAILY_LIMIT || 80);
const MAX_MESSAGE_CHARS = 1400;
const MAX_HISTORY_ITEMS = 8;
const { supabaseRequest } = require("./_supabase");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function compact(value, max = MAX_MESSAGE_CHARS) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function dedupeRepeatedText(value) {
  const text = compact(value, 2200);
  const half = Math.floor(text.length / 2);
  const left = text.slice(0, half).trim();
  const right = text.slice(half).trim();
  if (left.length > 30 && left === right) return left;

  const sentences = text.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [text];
  const seen = new Set();
  const out = [];
  for (const sentence of sentences) {
    const key = sentence.replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(sentence.trim());
  }
  return out.join(" ").trim();
}

function clientKey(req, body) {
  const userKey = compact(body.userId || body.loginId || body.phoneHash, 120);
  if (userKey) return userKey;
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "anonymous";
}

function takeQuota(key, limit) {
  if (!limit || limit < 1) return { ok: true, remaining: null };
  const today = new Date().toISOString().slice(0, 10);
  const store = (globalThis.__chajabotQuota ||= {});
  const bucketKey = `chat:${today}:${key}`;
  const used = store[bucketKey] || 0;
  if (used >= limit) return { ok: false, remaining: 0 };
  store[bucketKey] = used + 1;
  return { ok: true, remaining: Math.max(0, limit - store[bucketKey]) };
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: compact(item?.content || item?.text || "", 900),
    }))
    .filter((item) => item.content);
}

function transcriptFrom(history, message) {
  const lines = history.map((item) => `${item.role === "assistant" ? "찾아봇" : "사용자"}: ${item.content}`);
  lines.push(`사용자: ${message}`);
  return lines.join("\n");
}

function extractOutputText(data) {
  if (data?.output_text) return dedupeRepeatedText(data.output_text);
  const chunks = [];
  for (const output of data?.output || []) {
    for (const content of output?.content || []) {
      if (content?.text) chunks.push(content.text);
      if (content?.type === "output_text" && content?.text) chunks.push(content.text);
    }
  }
  return dedupeRepeatedText(chunks.join("\n"));
}

async function recordUsage(body, model, usage, quota) {
  const userId = compact(body.userId || "anonymous", 140);
  const eventId = `usage_chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const inputTokens = Number(usage?.input_tokens || usage?.prompt_tokens || 0) || null;
  const outputTokens = Number(usage?.output_tokens || usage?.completion_tokens || 0) || null;
  await supabaseRequest("/usage_events", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: eventId,
      user_id: userId,
      feature: "chat",
      provider: "openai",
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      request_count: 1,
      metadata: {
        subject: body.subject || null,
        userType: body.userType || null,
        quotaRemaining: quota?.remaining ?? null,
      },
    },
  });
}

const instructions = [
  "너는 '찾아봇'의 자유대화 AI다. 한국어 존댓말을 쓰고, 고령자도 이해하기 쉬운 말로 짧고 따뜻하게 답한다.",
  "사용자는 AI 교육 실습 중일 수 있다. 일상대화, 생일 문자, 삼행시, 간단한 글쓰기, 스마트폰/AI 사용 질문에 자연스럽게 답한다.",
  "복지자원 추천, 기관 정보, 신청 방법을 묻는 경우에는 앱의 추천 카드나 복지자원 찾기 흐름을 이용하라고 안내한다. DB에 없는 기관/전화/링크는 지어내지 않는다.",
  "의료·법률·금융 판단은 단정하지 말고 전문가 상담을 권한다. 위급 상황, 자해, 폭력, 호흡곤란, 화재 등은 즉시 119 또는 주변 사람에게 도움을 요청하라고 말한다.",
  "답변은 기본 3~6문장으로 한다. 필요한 경우 번호 목록을 쓰되 길게 늘리지 않는다. 같은 문장이나 같은 예시는 반복하지 않는다.",
].join("\n");

module.exports = async function chatHandler(req, res) {
  if (req.method && !["POST", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 501, { error: "OpenAI API key is not configured" });
  }

  const body = readBody(req);
  const message = compact(body.message || body.query || "");
  if (!message) return sendJson(res, 400, { error: "Message is required" });

  const quota = takeQuota(clientKey(req, body), DAILY_LIMIT);
  if (!quota.ok) {
    return sendJson(res, 429, {
      error: "Daily chat limit reached",
      message: "오늘 자유대화 사용 한도에 도달했어요. 잠시 뒤 담당자에게 말씀해 주세요.",
      quota,
    });
  }

  const history = normalizeHistory(body.history);
  const model = compact(body.model || DEFAULT_MODEL, 80);
  const payload = {
    model,
    instructions,
    input: transcriptFrom(history, message),
    max_output_tokens: Number(process.env.OPENAI_CHAT_MAX_OUTPUT_TOKENS || 700),
    store: false,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "OpenAI chat request failed",
        detail: text.slice(0, 700),
      });
    }

    const answer = extractOutputText(data);
    if (!answer) return sendJson(res, 502, { error: "Empty OpenAI answer" });
    await recordUsage(body, model, data.usage || null, quota).catch(() => {});

    return sendJson(res, 200, {
      answer,
      generatedBy: "openai",
      mode: "free-chat",
      model,
      quota,
      usage: data.usage || null,
    });
  } catch (error) {
    return sendJson(res, 500, { error: "OpenAI chat request failed" });
  }
};
