const { supabaseRequest } = require("./_supabase");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

module.exports = async function participantsHandler(req, res) {
  if (req.method && !["GET", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const result = await supabaseRequest(
    "/participants?active=eq.true&select=id,display_name&order=sort_order.asc,display_name.asc"
  );
  if (!result.configured) return sendJson(res, 200, { participants: [], dbConfigured: false });
  if (!result.ok) {
    return sendJson(res, 200, {
      participants: [],
      dbConfigured: true,
      warning: { error: "Participants request failed", status: result.status },
    });
  }

  const participants = (Array.isArray(result.data) ? result.data : [])
    .filter((row) => row?.id && row?.display_name)
    .map((row) => ({ id: row.id, displayName: row.display_name }));
  return sendJson(res, 200, { participants, dbConfigured: true });
};
