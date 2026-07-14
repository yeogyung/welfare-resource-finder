const { supabaseRequest } = require("./_supabase");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

function clean(value, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function getToken(req, url) {
  const auth = String(req.headers.authorization || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return String(req.headers["x-admin-token"] || "").trim();
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

async function loadLogs(limit) {
  const [conversations, messages, usage, users] = await Promise.all([
    supabaseRequest(`/conversations?select=id,user_id,user_type,subject,title,mode,created_at,updated_at&order=updated_at.desc&limit=${limit}`),
    supabaseRequest(`/messages?select=id,conversation_id,user_id,role,content,content_kind,mode,created_at&order=created_at.desc&limit=${limit}`),
    supabaseRequest(`/usage_events?select=id,user_id,feature,provider,model,input_tokens,output_tokens,request_count,metadata,created_at&order=created_at.desc&limit=${limit}`),
    supabaseRequest(`/app_users?select=id,display_name,phone_masked,subject,user_type,matched,last_seen_at,created_at&order=last_seen_at.desc&limit=${Math.min(limit, 50)}`),
  ]);
  return { conversations, messages, usage, users };
}

module.exports = async function adminLogsHandler(req, res) {
  if (req.method && !["GET", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const adminToken = String(process.env.ADMIN_TOKEN || "").trim();
  if (!adminToken) return sendJson(res, 501, { error: "ADMIN_TOKEN is not configured" });

  const url = new URL(req.url || "/", "https://local.chajabot");
  if (getToken(req, url) !== adminToken) return sendJson(res, 401, { error: "Invalid admin token" });

  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") || 80)));
  const format = clean(url.searchParams.get("format"), 20);
  const logs = await loadLogs(limit);
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
};
