const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";
const DEFAULT_STICKER_MODEL = process.env.OPENAI_STICKER_IMAGE_MODEL || "gpt-image-1";
const DAILY_LIMIT = Number(process.env.OPENAI_IMAGE_DAILY_LIMIT || 3);
const MAX_PROMPT_CHARS = 4000;
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
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

function compact(value, max = MAX_PROMPT_CHARS) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
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
  const bucketKey = `image:${today}:${key}`;
  const used = store[bucketKey] || 0;
  if (used >= limit) return { ok: false, remaining: 0 };
  store[bucketKey] = used + 1;
  return { ok: true, remaining: Math.max(0, limit - store[bucketKey]) };
}

function normalizeSize(size) {
  const allowed = new Set(["1024x1024", "1024x1536", "1536x1024"]);
  return allowed.has(size) ? size : "1024x1024";
}

function resolveModel(body) {
  if (body.model) return compact(body.model, 80);
  if (body.templateId === "sticker_from_photo") return DEFAULT_STICKER_MODEL;
  return DEFAULT_MODEL;
}

function dataUrlToBlobParts(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
  return { mime, buffer };
}

function extractImage(data) {
  const first = data?.data?.[0] || data?.output?.[0] || {};
  const b64 = first.b64_json || first.image_base64 || first.result;
  const url = first.url || first.image_url;
  return {
    imageUrl: b64 ? `data:image/png;base64,${b64}` : url || null,
    revisedPrompt: first.revised_prompt || data?.revised_prompt || null,
  };
}

async function recordUsage(body, mode, model, quota) {
  const userId = compact(body.userId || "anonymous", 140);
  const eventId = `usage_image_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await supabaseRequest("/usage_events", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: eventId,
      user_id: userId,
      feature: mode === "edit" ? "image_edit" : "image_generate",
      provider: "openai",
      model,
      request_count: 1,
      metadata: {
        subject: body.subject || null,
        userType: body.userType || null,
        templateId: body.templateId || null,
        quotaRemaining: quota?.remaining ?? null,
      },
    },
  });
}

module.exports = async function imageHandler(req, res) {
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
  const mode = body.mode === "edit" ? "edit" : "generate";
  const prompt = compact(body.prompt || body.query || "");
  if (!prompt) return sendJson(res, 400, { error: "Prompt is required" });

  const quota = takeQuota(clientKey(req, body), DAILY_LIMIT);
  if (!quota.ok) {
    return sendJson(res, 429, {
      error: "Daily image limit reached",
      message: "오늘 이미지 사용 한도에 도달했어요. 잠시 뒤 담당자에게 말씀해 주세요.",
      quota,
    });
  }

  const model = resolveModel(body);
  const size = normalizeSize(body.size);
  const endpoint = mode === "edit" ? "https://api.openai.com/v1/images/edits" : "https://api.openai.com/v1/images/generations";

  try {
    let response;
    if (mode === "edit") {
      const image = dataUrlToBlobParts(body.imageDataUrl || body.image || "");
      if (!image) return sendJson(res, 400, { error: "Valid imageDataUrl is required for edit mode" });
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", prompt);
      form.append("size", size);
      form.append("image", new Blob([image.buffer], { type: image.mime }), "upload.png");
      response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } else {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, prompt, size, n: 1 }),
      });
    }

    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "OpenAI image request failed",
        detail: text.slice(0, 700),
      });
    }

    const image = extractImage(data);
    if (!image.imageUrl) return sendJson(res, 502, { error: "Empty OpenAI image result" });
    await recordUsage(body, mode, model, quota).catch(() => {});

    return sendJson(res, 200, {
      ...image,
      generatedBy: "openai",
      mode,
      model,
      quota,
    });
  } catch (error) {
    return sendJson(res, 500, { error: "OpenAI image request failed" });
  }
};
