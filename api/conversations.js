const { supabaseRequest, encodeEq } = require("./_supabase");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

function clean(value, max = 140) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

module.exports = async function conversationsHandler(req, res) {
  if (req.method && !["GET", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url || "/", "https://local.chajabot");
  const userId = clean(url.searchParams.get("userId"), 140);
  const conversationId = clean(url.searchParams.get("conversationId"), 140);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  if (!userId) return sendJson(res, 400, { error: "userId is required" });

  if (conversationId) {
    const messages = await supabaseRequest(
      `/messages?conversation_id=eq.${encodeEq(conversationId)}&user_id=eq.${encodeEq(userId)}&select=id,role,content,content_kind,mode,metadata,created_at&order=created_at.asc&limit=200`
    );
    if (!messages.configured) return sendJson(res, 200, { messages: [], dbConfigured: false });
    if (!messages.ok) {
      return sendJson(res, 200, {
        messages: [],
        dbConfigured: true,
        warning: { status: messages.status, detail: messages.detail },
      });
    }
    return sendJson(res, 200, { messages: messages.data || [], dbConfigured: true });
  }

  const conversations = await supabaseRequest(
    `/conversations?user_id=eq.${encodeEq(userId)}&select=id,title,mode,subject,user_type,created_at,updated_at&order=updated_at.desc&limit=${limit}`
  );
  if (!conversations.configured) return sendJson(res, 200, { conversations: [], dbConfigured: false });
  if (!conversations.ok) {
    return sendJson(res, 200, {
      conversations: [],
      dbConfigured: true,
      warning: { status: conversations.status, detail: conversations.detail },
    });
  }

  return sendJson(res, 200, { conversations: conversations.data || [], dbConfigured: true });
};
