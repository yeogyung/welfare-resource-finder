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

function clean(value, max = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

module.exports = async function logoutHandler(req, res) {
  if (req.method && !["POST", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const body = readBody(req);
  const userId = clean(body.userId, 160);
  if (!userId) return sendJson(res, 400, { error: "userId is required" });

  try {
    const released = await supabaseRequest(`/app_users?id=eq.${encodeEq(userId)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        participant_id: null,
        group_id: null,
        session_id: null,
        last_seen_at: "2000-01-01T00:00:00.000Z",
      },
    });

    if (!released.configured) return sendJson(res, 200, { ok: true, released: false, storage: "local-only" });
    if (!released.ok) {
      return sendJson(res, 200, {
        ok: false,
        released: false,
        warning: { status: released.status, detail: released.detail },
      });
    }

    return sendJson(res, 200, { ok: true, released: true });
  } catch (error) {
    return sendJson(res, 200, { ok: false, released: false });
  }
};
