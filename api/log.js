const { supabaseRequest } = require("./_supabase");

const ROLES = new Set(["user", "assistant", "system"]);
const MAX_CONTENT_CHARS = 6000;

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

function clean(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanLong(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_CONTENT_CHARS);
}

function safeId(value, fallbackPrefix) {
  const cleaned = String(value || "").replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 120);
  if (cleaned) return cleaned;
  return `${fallbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function titleFrom(content) {
  const title = clean(content, 42);
  return title || "새 대화";
}

module.exports = async function logHandler(req, res) {
  if (req.method && !["POST", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const body = readBody(req);
  const content = cleanLong(body.content || body.text || "");
  if (!content) return sendJson(res, 400, { error: "Content is required" });

  const role = ROLES.has(body.role) ? body.role : "user";
  const conversationId = safeId(body.conversationId, "conv");
  const messageId = safeId(body.messageId, "msg");
  const now = new Date().toISOString();
  const userId = clean(body.userId || "anonymous", 140);
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  try {
    const conversation = await supabaseRequest("/conversations?on_conflict=id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: {
        id: conversationId,
        user_id: userId,
        user_type: clean(body.userType || "unknown", 40),
        subject: clean(body.subject || "unknown", 40),
        title: titleFrom(body.title || content),
        mode: clean(body.mode || "chat", 40),
        source: clean(body.source || "web", 40),
        updated_at: now,
      },
    });
    if (!conversation.configured) return sendJson(res, 200, { stored: false, storage: "local-only" });
    if (!conversation.ok) {
      return sendJson(res, 200, {
        stored: false,
        storage: "local-fallback",
        warning: { table: "conversations", status: conversation.status, detail: conversation.detail },
      });
    }

    const message = await supabaseRequest("/messages?on_conflict=id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: {
        id: messageId,
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        content_kind: clean(body.contentKind || "text", 40),
        mode: clean(body.mode || "chat", 40),
        metadata,
        created_at: now,
      },
    });
    if (!message.ok) {
      return sendJson(res, 200, {
        stored: false,
        storage: "local-fallback",
        warning: { table: "messages", status: message.status, detail: message.detail },
      });
    }

    await supabaseRequest(`/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
      method: "PATCH",
      body: { updated_at: now },
      prefer: "return=minimal",
    });

    return sendJson(res, 200, { stored: true, storage: "supabase" });
  } catch (error) {
    return sendJson(res, 200, { stored: false, storage: "local-fallback" });
  }
};
