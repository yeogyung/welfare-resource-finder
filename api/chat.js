const DEFAULT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const DEFAULT_WEB_SEARCH_MODEL = process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-5.4-mini";
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

function cleanModelAnswer(value) {
  const normalized = String(value || "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 $2")
    .replace(/\*\*/g, "")
    .replace(/(^|\s)#{1,6}\s*/g, "$1");
  return dedupeRepeatedText(normalized)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 $2")
    .replace(/\*\*/g, "")
    .replace(/(^|\s)#{1,6}\s*/g, "$1")
    .replace(/\s+([1-9]\d*)\.\s+/g, "\n$1. ")
    .replace(/\s+([가-힣A-Za-z]):\s+/g, "\n$1: ")
    .replace(/(https?:\/\/[^\s]+)\.\s+([A-Za-z0-9][^\s]*)/g, "$1.$2")
    .replace(/(https?:\/\/[^\s]+)\/\s+([^\s]+)/g, "$1/$2")
    .replace(/(https?:\/\/[^\s]+[?&])\s+([A-Za-z0-9_%=-][^\s]*)/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  if (data?.output_text) return cleanModelAnswer(data.output_text);
  const chunks = [];
  for (const output of data?.output || []) {
    for (const content of output?.content || []) {
      if (content?.text) chunks.push(content.text);
      if (content?.type === "output_text" && content?.text) chunks.push(content.text);
    }
  }
  return cleanModelAnswer(chunks.join("\n"));
}

function isPersonalWeatherContext(message) {
  const q = String(message || "").replace(/생활비/g, "");
  const hasWeatherSignal =
    /날씨|기온|습도|우산|옷차림|비\s*(?:가|와|오|올|내리|는|도|많이)|비올|눈\s*(?:이|와|오|올|내리|은)|오늘.*(?:더워|추워|덥|춥)|밖.*(?:더워|추워|덥|춥)/.test(q);
  if (!hasWeatherSignal) return false;
  const personalContext =
    /우울|울적|마음|기분|외롭|무릎|무릅|관절|허리|어깨|시려|시리|아파|아프|통증|몸|건강|치료|혈압|불안|걱정|힘들|잠이|잠\s*안|운동/.test(q);
  if (!personalContext) return false;
  const strongWeatherRequest =
    /(?:날씨|기온|습도).{0,18}(?:어때|어떤|알려|확인|궁금|조회|볼래|보여|추천|봐줘)|(?:우산|옷차림).{0,18}(?:필요|챙|추천|어떻게|입|가져)/.test(q);
  return !strongWeatherRequest;
}

function shouldUseWebSearch(message) {
  if (process.env.OPENAI_WEB_SEARCH_ENABLED === "0") return false;
  if (isPersonalWeatherContext(message)) return false;
  const q = String(message || "");
  const liveIntent =
    /오늘|내일|이번\s*(주|달|달엔|주말)|지금|현재|최근|최신|실시간|새로|업데이트/.test(q) ||
    /할인|행사|이벤트|쿠폰|가격|요금|입장료|예매|예약|상영|시간표|운영\s*시간|영업\s*시간|휴무|근처|주소|전화번호|홈페이지|웹사이트/.test(q) ||
    /영화관|CGV|씨지브이|롯데시네마|메가박스|극장|카드\s*할인|통신사\s*할인|멤버십/.test(q) ||
    /날씨|교통|뉴스|공연|전시|박물관|축제/.test(q);
  const creativeOnly = /삼행시|생일\s*문자|축하\s*문자|편지|농담|이야기\s*해줘|시\s*써|사진|이미지|이모티콘/.test(q);
  const dailyPhraseOnly = /기분\s*좋게|좋은\s*말|시작하는\s*말|응원|위로|덕담|인사말|안부\s*문자|좋은\s*글|문구|짧은\s*말/.test(q);
  if (dailyPhraseOnly && !/날씨|할인|행사|이벤트|가격|요금|상영|운영\s*시간|영업\s*시간|뉴스|교통|공연|전시|축제/.test(q)) {
    return false;
  }
  return liveIntent && !creativeOnly;
}

function isCinemaDiscountQuery(message) {
  const q = String(message || "");
  return /영화관|CGV|씨지브이|롯데시네마|메가박스|극장/.test(q) && /할인|쿠폰|이벤트|행사|가격|요금|예매/.test(q);
}

function koreaDateLabel() {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function inputFor(history, message, { webSearch }) {
  const transcript = transcriptFrom(history, message);
  if (!webSearch) return transcript;
  const hints = [];
  if (isCinemaDiscountQuery(message)) {
    hints.push(
      "영화관 할인 질문이다. CGV, 롯데시네마, 메가박스 공식 할인/이벤트 페이지를 우선 확인해서 영화관별로 짧게 안내한다.",
      "너무 넓은 질문이라도 '확인해 보세요'만 말하지 말고, 현재 확인 가능한 대표 할인 경로와 주의사항을 먼저 답한다.",
      "공식 확인 후보 URL: CGV 쿠폰/제휴할인 https://cgv.co.kr/evt/discountInformation",
      "공식 확인 후보 URL: 롯데시네마 이벤트 https://www.lottecinema.co.kr/NLCMW/Event",
      "공식 확인 후보 URL: 메가박스 제휴/할인 이벤트 https://megabox.co.kr/event/promotion"
    );
  }
  hints.push("출처 URL은 반드시 평문 URL로 답변 끝에 적는다.");
  return `${transcript}\n\n검색 지시:\n${hints.join("\n")}`;
}

function instructionsFor({ webSearch }) {
  if (!webSearch) return instructions;
  return [
    instructions,
    `오늘 날짜는 ${koreaDateLabel()}이다.`,
    "사용자가 할인, 행사, 영화관, 가격, 상영시간, 운영시간, 최신 정보처럼 바뀔 수 있는 정보를 물으면 웹검색으로 확인한 내용만 답한다.",
    "영화관 할인은 CGV, 롯데시네마, 메가박스, 카드사, 통신사 등 공식 페이지를 우선 확인한다.",
    "정확한 할인 적용 여부는 지점, 카드, 통신사, 연령, 예매 경로에 따라 달라질 수 있다고 짧게 알려준다.",
    "웹검색을 사용한 답변 끝에는 '확인한 곳'을 쓰고, 출처 이름과 URL을 2~4개 적는다.",
    "마크다운 링크 형식 [이름](URL)은 쓰지 말고, 출처 URL은 그대로 적는다.",
    "검색 답변도 본문은 5문장 이내로 짧게 쓴다. 자세한 내용은 출처 확인으로 넘긴다.",
  ].join("\n");
}

function extractCitations(data) {
  const seen = new Set();
  const citations = [];
  for (const output of data?.output || []) {
    for (const content of output?.content || []) {
      for (const ann of content?.annotations || []) {
        if (ann?.type !== "url_citation" || !ann.url || seen.has(ann.url)) continue;
        seen.add(ann.url);
        citations.push({ title: compact(ann.title || "관련 페이지", 120), url: ann.url });
      }
    }
  }
  return citations.slice(0, 4);
}

function usedWebSearch(data) {
  return Array.isArray(data?.output) && data.output.some((item) => item?.type === "web_search_call");
}

function appendSources(answer, citations) {
  if (!citations.length) return answer;
  const sourceLines = citations
    .filter((item) => item.url && !answer.includes(item.url))
    .map((item, index) => `${index + 1}. ${item.title} ${item.url}`);
  if (!sourceLines.length) return answer;
  return `${answer}\n\n확인한 곳\n${sourceLines.join("\n")}`;
}

function stripInlineSources(answer) {
  return String(answer || "")
    .replace(/\s*\([^()]*https?:\/\/[^()]+?\)/g, "")
    .replace(/\n?\s*확인한 곳[\s\S]*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fallbackCitationsFor(message) {
  if (!isCinemaDiscountQuery(message)) return [];
  return [
    { title: "CGV 쿠폰/제휴할인", url: "https://cgv.co.kr/evt/discountInformation" },
    { title: "롯데시네마 이벤트", url: "https://www.lottecinema.co.kr/NLCMW/Event" },
    { title: "메가박스 제휴/할인 이벤트", url: "https://megabox.co.kr/event/promotion" },
  ];
}

async function recordUsage(body, model, usage, quota, extra = {}) {
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
      feature: extra.feature || "chat",
      provider: "openai",
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      request_count: 1,
      metadata: {
        subject: body.subject || null,
        userType: body.userType || null,
        quotaRemaining: quota?.remaining ?? null,
        webSearch: Boolean(extra.webSearch),
        sourceCount: Number(extra.sourceCount || 0),
      },
    },
  });
}

const instructions = [
  "너는 '찾아봇'의 자유대화 AI다. 한국어 존댓말을 쓰고, 고령자도 이해하기 쉬운 말로 짧고 따뜻하게 답한다.",
  "사용자는 AI 교육 실습 중일 수 있다. 일상대화, 생일 문자, 삼행시, 간단한 글쓰기, 스마트폰/AI 사용 질문에 자연스럽게 답한다.",
  "사용자가 명확히 복지자원, 기관, 신청 방법을 묻지 않았다면 복지 추천으로 성급하게 돌리지 말고 일반 대화를 먼저 이어간다.",
  "건강·의료 일반 질문도 먼저 질문에 답한다. 예를 들어 '백내장 치료 추천해줘'처럼 물으면 백내장이 무엇인지, 보통 안과 진료와 수술 상담으로 확인한다는 점, 빨리 진료가 필요한 증상을 쉬운 말로 설명한다.",
  "의료 답변은 진단·처방처럼 단정하지 말고 일반 정보로 안내한다. 마지막에는 정확한 판단은 안과, 병원, 의사와 상담하라고 부드럽게 덧붙인다.",
  "복지자원 추천, 기관 정보, 신청 방법을 명확히 묻는 경우에는 앱의 추천 카드나 복지자원 찾기 흐름을 이용하라고 짧게 안내한다. DB에 없는 기관/전화/링크는 지어내지 않는다.",
  "법률·금융 판단은 단정하지 말고 전문가 상담을 권한다. 위급 상황, 자해, 폭력, 호흡곤란, 화재 등은 즉시 119 또는 주변 사람에게 도움을 요청하라고 말한다.",
  "답변은 기본 2~4문장으로 한다. 필요한 경우 번호 목록은 최대 3개까지만 쓴다.",
  "일상·건강 실천법을 묻는 질문은 도입 1문장과 실천법 3개만 답한다. 번호 목록 뒤에는 추가 마무리 문장을 쓰지 않는다.",
  "한 번에 4개 이상 제안하지 않고, 각 항목은 한 줄로 짧게 쓴다.",
  "번호 목록, 삼행시, 문자 예시는 각 항목마다 줄을 바꿔 읽기 쉽게 쓴다.",
  "사용자가 두 가지를 한 번에 물으면 짧은 소제목 없이 '먼저', '그리고' 정도로 나누어 순서대로 답한다.",
  "마크다운 강조 기호인 **, 제목 기호 #, 표 형식은 쓰지 않는다. 화면에 바로 읽히는 평문으로 답한다.",
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
  const webSearch = shouldUseWebSearch(message);
  const model = webSearch ? compact(body.webSearchModel || DEFAULT_WEB_SEARCH_MODEL, 80) : compact(body.model || DEFAULT_MODEL, 80);
  const payload = {
    model,
    instructions: instructionsFor({ webSearch }),
    input: inputFor(history, message, { webSearch }),
    max_output_tokens: Number(process.env.OPENAI_CHAT_MAX_OUTPUT_TOKENS || 700),
    store: false,
  };
  if (webSearch) {
    payload.tools = [{ type: "web_search" }];
    payload.tool_choice = "required";
  }

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
        message: webSearch
          ? "실시간 정보 검색 연결이 잠시 어렵습니다. 조금 뒤 다시 물어봐 주세요."
          : undefined,
        detail: text.slice(0, 700),
      });
    }

    const citations = extractCitations(data);
    const webSearchUsed = webSearch && usedWebSearch(data);
    const fallbackCitations = fallbackCitationsFor(message);
    const finalCitations = fallbackCitations.length ? fallbackCitations : citations;
    const bodyAnswer = webSearch ? stripInlineSources(extractOutputText(data)) : extractOutputText(data);
    const answer = appendSources(bodyAnswer, finalCitations);
    if (!answer) return sendJson(res, 502, { error: "Empty OpenAI answer" });
    await recordUsage(body, model, data.usage || null, quota, {
      feature: webSearchUsed ? "chat_web_search" : "chat",
      webSearch: webSearchUsed,
      sourceCount: finalCitations.length,
    }).catch(() => {});

    return sendJson(res, 200, {
      answer,
      generatedBy: "openai",
      mode: webSearchUsed ? "web-search-chat" : "free-chat",
      model,
      quota,
      webSearch: webSearchUsed,
      sources: finalCitations,
      usage: data.usage || null,
    });
  } catch (error) {
    return sendJson(res, 500, { error: "OpenAI chat request failed" });
  }
};
