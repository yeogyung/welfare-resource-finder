const { supabaseRequest, encodeEq } = require("./_supabase");

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

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(rows) {
  if (!rows.length) return "type,id,created_at,user_id,summary\n";
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set(["type", "id", "created_at"])));
  return `${headers.join(",")}\n${rows.map((row) => headers.map((key) => csvEscape(row[key])).join(",")).join("\n")}\n`;
}

function getAdminToken(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return String(req.headers["x-admin-token"] || "").trim();
}

async function handleConversationRead(url, res) {
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
}

async function loadAdminLogs(limit) {
  const [conversations, messages, usage, users] = await Promise.all([
    supabaseRequest(`/conversations?select=id,user_id,user_type,subject,title,mode,created_at,updated_at&order=updated_at.desc&limit=${limit}`),
    supabaseRequest(`/messages?select=id,conversation_id,user_id,role,content,content_kind,mode,created_at&order=created_at.desc&limit=${limit}`),
    supabaseRequest(`/usage_events?select=id,user_id,feature,provider,model,input_tokens,output_tokens,request_count,metadata,created_at&order=created_at.desc&limit=${limit}`),
    supabaseRequest(`/app_users?select=id,display_name,phone_masked,subject,user_type,matched,last_seen_at,created_at&order=last_seen_at.desc&limit=${Math.min(limit, 50)}`),
  ]);
  return { conversations, messages, usage, users };
}

async function handleAdminLogs(req, res, url) {
  const adminToken = String(process.env.ADMIN_TOKEN || "").trim();
  if (!adminToken) return sendJson(res, 501, { error: "ADMIN_TOKEN is not configured" });
  if (getAdminToken(req) !== adminToken) return sendJson(res, 401, { error: "Invalid admin token" });

  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") || 80)));
  const format = clean(url.searchParams.get("format"), 20);
  const logs = await loadAdminLogs(limit);
  const configured = Object.values(logs).some((result) => result.configured);
  if (!configured) return sendJson(res, 200, { dbConfigured: false, conversations: [], messages: [], usageEvents: [], users: [] });

  const payload = {
    dbConfigured: true,
    generatedAt: new Date().toISOString(),
    conversations: logs.conversations.ok ? logs.conversations.data || [] : [],
    messages: logs.messages.ok ? logs.messages.data || [] : [],
    usageEvents: logs.usage.ok ? logs.usage.data || [] : [],
    users: logs.users.ok ? logs.users.data || [] : [],
    warnings: Object.fromEntries(
      Object.entries(logs)
        .filter(([, result]) => result.configured && !result.ok)
        .map(([key, result]) => [key, { status: result.status, detail: result.detail }])
    ),
  };

  if (format === "csv") {
    const rows = [
      ...payload.conversations.map((row) => ({
        type: "conversation",
        id: row.id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user_id: row.user_id,
        subject: row.subject,
        mode: row.mode,
        summary: row.title,
      })),
      ...payload.messages.map((row) => ({
        type: "message",
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        conversation_id: row.conversation_id,
        role: row.role,
        mode: row.mode,
        summary: String(row.content || "").slice(0, 300),
      })),
      ...payload.usageEvents.map((row) => ({
        type: "usage_event",
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        feature: row.feature,
        provider: row.provider,
        model: row.model,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        request_count: row.request_count,
        summary: JSON.stringify(row.metadata || {}).slice(0, 300),
      })),
    ];
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=chajabot-admin-logs.csv");
    res.setHeader("Cache-Control", "no-store");
    return res.end(rowsToCsv(rows));
  }

  return sendJson(res, 200, payload);
}

module.exports = async function logHandler(req, res) {
  if (req.method && !["GET", "POST", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    const url = new URL(req.url || "/", "https://local.chajabot");
    if (url.searchParams.get("admin") === "1") return handleAdminLogs(req, res, url);
    return handleConversationRead(url, res);
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
