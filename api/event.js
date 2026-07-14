const { supabaseRequest } = require("./_supabase");

const MAX_EVENT_CHARS = 80;
const MAX_META_CHARS = 1200;

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

function clean(value, max = MAX_EVENT_CHARS) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanEventName(value) {
  return clean(value, MAX_EVENT_CHARS).replace(/[^a-zA-Z0-9_.:-]/g, "_");
}

function safeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value).slice(0, MAX_META_CHARS));
  } catch {
    return {};
  }
}

module.exports = async function eventHandler(req, res) {
  if (req.method && !["GET", "POST", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    const ga4MeasurementId = String(process.env.GA4_MEASUREMENT_ID || "").trim();
    return sendJson(res, 200, {
      ga4MeasurementId: /^G-[A-Z0-9]+$/i.test(ga4MeasurementId) ? ga4MeasurementId : "",
    });
  }

  const body = readBody(req);
  const eventName = cleanEventName(body.event || body.name || "");
  if (!eventName) return sendJson(res, 400, { error: "Event name is required" });

  try {
    const result = await supabaseRequest("/usage_events", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        user_id: clean(body.userId || "anonymous", 140),
        feature: `event:${eventName}`,
        provider: "app",
        request_count: 1,
        metadata: {
          userType: clean(body.userType || "unknown", 40),
          subject: clean(body.subject || "unknown", 40),
          conversationId: clean(body.conversationId || "", 120),
          ...safeMetadata(body.metadata),
        },
      },
    });

    if (!result.configured) return sendJson(res, 200, { stored: false, storage: "local-only" });
    if (!result.ok) {
      return sendJson(res, 200, {
        stored: false,
        storage: "local-fallback",
        warning: { table: "usage_events", status: result.status },
      });
    }

    return sendJson(res, 200, { stored: true, storage: "supabase" });
  } catch {
    return sendJson(res, 200, { stored: false, storage: "local-fallback" });
  }
};
