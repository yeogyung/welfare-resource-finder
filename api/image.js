const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const DEFAULT_STICKER_MODEL = process.env.OPENAI_STICKER_IMAGE_MODEL || "gpt-image-2";
const DEFAULT_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";
const DEFAULT_STICKER_QUALITY = process.env.OPENAI_STICKER_IMAGE_QUALITY || "medium";
const DAILY_LIMIT = Number(process.env.OPENAI_IMAGE_DAILY_LIMIT || 3);
const MAX_PROMPT_CHARS = 4000;
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const { supabaseRequest, encodeEq } = require("./_supabase");

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

function takeMemoryQuota(key, limit) {
  if (!limit || limit < 1) return { ok: true, remaining: null };
  const today = new Date().toISOString().slice(0, 10);
  const store = (globalThis.__chajabotQuota ||= {});
  const bucketKey = `image:${today}:${key}`;
  const used = store[bucketKey] || 0;
  if (used >= limit) return { ok: false, remaining: 0 };
  store[bucketKey] = used + 1;
  return { ok: true, remaining: Math.max(0, limit - store[bucketKey]), source: "memory", key };
}

function kstQuotaWindow(now = new Date()) {
  const offsetMs = 9 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const start = new Date(Date.UTC(y, m, d) - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

async function countDbImageUsage(key, window) {
  const path = [
    `/usage_events?user_id=eq.${encodeEq(key)}`,
    "feature=in.(image_edit,image_generate)",
    `created_at=gte.${encodeEq(window.startIso)}`,
    `created_at=lt.${encodeEq(window.endIso)}`,
    "select=request_count",
  ].join("&");
  const result = await supabaseRequest(path);
  if (!result.configured) return { configured: false, used: 0 };
  if (!result.ok) return { configured: true, ok: false, status: result.status, detail: result.detail };
  const rows = Array.isArray(result.data) ? result.data : [];
  const used = rows.reduce((sum, row) => sum + (Number(row.request_count) || 1), 0);
  return { configured: true, ok: true, used };
}

function normalizeSize(size) {
  const allowed = new Set(["1024x1024", "1024x1536", "1536x1024"]);
  return allowed.has(size) ? size : "1024x1024";
}

function resolveModel(body) {
  if (body.model) return compact(body.model, 80);
  if (body.templateId === "sticker_from_photo" || body.templateId === "single_sticker_from_photo") return DEFAULT_STICKER_MODEL;
  return DEFAULT_MODEL;
}

function normalizeQuality(quality) {
  const allowed = new Set(["low", "medium", "high", "auto"]);
  return allowed.has(quality) ? quality : "medium";
}

function resolveQuality(body) {
  if (body.quality) return normalizeQuality(compact(body.quality, 20));
  if (body.templateId === "sticker_from_photo" || body.templateId === "single_sticker_from_photo") return normalizeQuality(DEFAULT_STICKER_QUALITY);
  return normalizeQuality(DEFAULT_QUALITY);
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

async function reserveDbQuota(key, body, mode, model, quality, limit) {
  if (!limit || limit < 1) return { ok: true, remaining: null, source: "disabled", key };

  const window = kstQuotaWindow();
  const counted = await countDbImageUsage(key, window);
  if (!counted.configured) return takeMemoryQuota(key, limit);
  if (!counted.ok) {
    return {
      ok: false,
      statusCode: 503,
      remaining: 0,
      source: "supabase",
      message: "이미지 사용량 확인이 잠시 어렵습니다. 담당자에게 말씀해 주세요.",
      detail: counted.detail || "",
    };
  }
  if (counted.used >= limit) {
    return { ok: false, statusCode: 429, remaining: 0, source: "supabase", key };
  }

  const eventId = `usage_image_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const remaining = Math.max(0, limit - counted.used - 1);
  const metadata = {
    status: "reserved",
    subject: body.subject || null,
    userType: body.userType || null,
    templateId: body.templateId || null,
    quotaKey: key,
    quotaDateKst: window.date,
    quotaLimit: limit,
    quotaRemaining: remaining,
    quality,
  };
  const result = await supabaseRequest("/usage_events", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: eventId,
      user_id: key,
      feature: mode === "edit" ? "image_edit" : "image_generate",
      provider: "openai",
      model,
      request_count: 1,
      metadata,
    },
  });
  if (!result.configured) return takeMemoryQuota(key, limit);
  if (!result.ok) {
    return {
      ok: false,
      statusCode: 503,
      remaining: 0,
      source: "supabase",
      message: "이미지 사용량 저장이 잠시 어렵습니다. 담당자에게 말씀해 주세요.",
      detail: result.detail || "",
    };
  }
  return { ok: true, remaining, source: "supabase", key, eventId, metadata };
}

async function markUsage(eventId, metadata, status, extra = {}) {
  if (!eventId) return;
  await supabaseRequest(`/usage_events?id=eq.${encodeEq(eventId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      metadata: {
        ...(metadata || {}),
        ...extra,
        status,
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
  const editImage = mode === "edit" ? dataUrlToBlobParts(body.imageDataUrl || body.image || "") : null;
  if (mode === "edit" && !editImage) {
    return sendJson(res, 400, { error: "Valid imageDataUrl is required for edit mode" });
  }

  const model = resolveModel(body);
  const quality = resolveQuality(body);
  const quota = await reserveDbQuota(clientKey(req, body), body, mode, model, quality, DAILY_LIMIT);
  if (!quota.ok) {
    return sendJson(res, quota.statusCode || 429, {
      error: "Daily image limit reached",
      message: quota.message || "오늘 이미지 사용 한도에 도달했어요. 잠시 뒤 담당자에게 말씀해 주세요.",
      quota,
    });
  }

  const size = normalizeSize(body.size);
  const endpoint = mode === "edit" ? "https://api.openai.com/v1/images/edits" : "https://api.openai.com/v1/images/generations";

  try {
    let response;
    if (mode === "edit") {
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", prompt);
      form.append("size", size);
      form.append("quality", quality);
      form.append("image", new Blob([editImage.buffer], { type: editImage.mime }), "upload.png");
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
        body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
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
      await markUsage(quota.eventId, quota.metadata, "failed", {
        openaiStatus: response.status,
        error: text.slice(0, 260),
      }).catch(() => {});
      return sendJson(res, response.status, {
        error: "OpenAI image request failed",
        detail: text.slice(0, 700),
      });
    }

    const image = extractImage(data);
    if (!image.imageUrl) {
      await markUsage(quota.eventId, quota.metadata, "failed", { error: "empty_result" }).catch(() => {});
      return sendJson(res, 502, { error: "Empty OpenAI image result" });
    }
    await markUsage(quota.eventId, quota.metadata, "success", {
      revisedPrompt: image.revisedPrompt || null,
    }).catch(() => {});

    return sendJson(res, 200, {
      ok: true,
      ...image,
      imageDataUrl: image.imageUrl,
      generatedBy: "openai",
      mode,
      model,
      quality,
      quota,
    });
  } catch (error) {
    await markUsage(quota.eventId, quota.metadata, "failed", {
      error: error?.message ? String(error.message).slice(0, 260) : "network",
    }).catch(() => {});
    return sendJson(res, 500, { error: "OpenAI image request failed" });
  }
};
