const { supabaseRequest, encodeEq } = require("./_supabase");

const PARTICIPANT_LOCK_AFTER = process.env.PARTICIPANT_LOCK_AFTER || "2026-07-21T15:45:00.000Z";

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

  const usedResult = await supabaseRequest(
    `/app_users?participant_id=not.is.null&last_seen_at=gte.${encodeEq(PARTICIPANT_LOCK_AFTER)}&select=participant_id`
  );
  const lockedIds = new Set(
    Array.isArray(usedResult.data) ? usedResult.data.map((row) => row?.participant_id).filter(Boolean) : []
  );

  const participants = (Array.isArray(result.data) ? result.data : [])
    .filter((row) => row?.id && row?.display_name)
    .map((row) => ({ id: row.id, displayName: row.display_name, locked: lockedIds.has(row.id) }));
  return sendJson(res, 200, { participants, dbConfigured: true });
};
