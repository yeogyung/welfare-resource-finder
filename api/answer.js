const fs = require("fs");
const path = require("path");
const engine = require("../public/js/chajabot-engine.js");
const crypto = require("crypto");

const DEFAULT_ENDPOINT = "https://clovastudio.stream.ntruss.com/v3/chat-completions/HCX-005";

let cachedResources = null;

function loadResources() {
  if (cachedResources) return cachedResources;
  const file = path.join(process.cwd(), "public", "data", "welfare-resources.json");
  cachedResources = JSON.parse(fs.readFileSync(file, "utf8"));
  return cachedResources;
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

function compact(value, max = 260) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeResults(results) {
  if (!Array.isArray(results)) return [];
  return results
    .map((row) => row && (row.item || row))
    .filter(Boolean)
    .slice(0, 3);
}

function buildContext(resources) {
  return resources.map((item, index) => ({
    index: index + 1,
    id: item.id,
    name: compact(item.name, 120),
    category: compact(item.categoryLabel || item.category, 60),
    target: compact(item.target, 180),
    region: compact(item.region, 80),
    period: compact(item.period, 80),
    description: compact(item.description, 360),
    method: compact(item.method, 220),
    contact: compact(item.contact, 80),
    url: compact(item.url, 180),
  }));
}

function buildPromptTexts(query, axisLabel, context) {
  return {
    system:
      "너는 고령자에게 복지자원을 안내하는 찾아봇이다. 너의 역할은 추천 결과를 새로 고르거나 바꾸는 것이 아니라, " +
      "이미 DB 검색 엔진이 고른 CONTEXT 자원을 쉬운 말로 설명하는 것이다. 반드시 제공된 CONTEXT 안의 정보만 사용한다. " +
      "CONTEXT의 순서를 바꾸거나, CONTEXT에 없는 복지자원을 추가 추천하지 않는다. " +
      "자원명은 CONTEXT의 name에 있는 이름만 사용할 수 있다. 전화번호, URL, 신청 자격, 신청 방법을 추측하거나 새로 만들지 않는다. " +
      "일상 대화처럼 보여도 긴 상담을 이어가지 말고, 사용자가 추천 카드에서 대상·신청 방법·전화 정보를 확인하도록 안내한다. " +
      "CONTEXT에 없는 내용은 '확인 후 안내가 필요해요'라고 말한다. " +
      "답변은 쉬운 한국어 존댓말로 4문장 이내, 불안감을 낮추는 말투로 작성한다.",
    user: [
      `사용자 질문: ${query || "선택형 문답 기반 추천"}`,
      `분류 축: ${axisLabel || "미분류"}`,
      "CONTEXT:",
      JSON.stringify(context, null, 2),
      "위 근거만 사용해서 사용자가 추천 카드를 확인하면 좋은 이유를 짧게 안내해 줘. 마지막 문장은 '추천 카드에서 자세한 대상과 신청 방법을 확인해 주세요.'와 비슷하게 마무리해.",
    ].join("\n"),
  };
}

function textContent(text) {
  return [{ type: "text", text }];
}

function makePayload(endpoint, model, promptTexts) {
  if (endpoint.includes("/v1/openai/")) {
    return {
      model,
      messages: [
        { role: "system", content: promptTexts.system },
        { role: "user", content: promptTexts.user },
      ],
      temperature: 0.2,
      top_p: 0.8,
      max_tokens: 420,
    };
  }
  return {
    messages: [
      { role: "system", content: textContent(promptTexts.system) },
      { role: "user", content: textContent(promptTexts.user) },
    ],
    temperature: 0.2,
    topP: 0.8,
    topK: 0,
    maxTokens: 420,
    repetitionPenalty: 1.05,
    stop: [],
    seed: 0,
    includeAiFilters: true,
  };
}

function generatedRequestId() {
  return crypto.randomUUID().replace(/-/g, "");
}

function contentToText(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || "").join(" ");
  }
  return content.text || content.content || "";
}

function extractAnswer(data) {
  return compact(
    contentToText(data?.choices?.[0]?.message?.content) ||
      contentToText(data?.result?.message?.content) ||
      data?.result?.text ||
      "",
    900,
  );
}

module.exports = async function answerHandler(req, res) {
  if (req.method && !["POST", "OPTIONS"].includes(req.method)) {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const apiKey = process.env.NCP_CLOVA_STUDIO_API_KEY;
  if (!apiKey) {
    res.statusCode = 501;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "CLOVA Studio is not configured" }));
  }

  const body = readBody(req);
  const query = compact(body.query, 220);
  const category = body.category || "all";
  const limit = Math.min(Math.max(Number(body.limit || 3), 1), 3);
  const resources = loadResources();
  const retrieved = normalizeResults(body.results);
  const payload = engine.recommend(resources, { query, category, limit });
  const selected = retrieved.length ? retrieved : payload.results.map((row) => row.item).slice(0, limit);
  const context = buildContext(selected);

  if (!context.length) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "No retrieved context" }));
  }

  const endpoint = process.env.NCP_CLOVA_STUDIO_ENDPOINT || DEFAULT_ENDPOINT;
  const model = process.env.NCP_CLOVA_STUDIO_MODEL || "HCX-005";
  const requestId = generatedRequestId();
  const promptTexts = buildPromptTexts(query, body.axisLabel || payload.axisLabel, context);

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-NCP-CLOVASTUDIO-REQUEST-ID": requestId,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(makePayload(endpoint, model, promptTexts)),
    });
    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      res.statusCode = response.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "CLOVA Studio request failed", detail: text.slice(0, 600) }));
    }

    const answer = extractAnswer(data);
    if (!answer) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Empty CLOVA Studio answer" }));
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({
      answer,
      generatedBy: "clova-studio",
      mode: "retrieval-grounded",
      requestId,
      query,
      axisLabel: body.axisLabel || payload.axisLabel,
      contextIds: context.map((item) => item.id),
    }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Grounded answer request failed" }));
  }
};
