const crypto = require("crypto");
const { supabaseRequest, encodeEq } = require("./_supabase");

const SUBJECTS = new Set(["general", "participant", "staff"]);
const PARTICIPANT_LOCK_AFTER = process.env.PARTICIPANT_LOCK_AFTER || "2026-07-21T15:45:00.000Z";

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

function clean(value, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeName(value) {
  return clean(value, 40).replace(/[^\p{L}\p{N}\s._-]/gu, "");
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 13);
}

function maskPhone(phone) {
  if (!phone) return "";
  if (phone.length <= 4) return phone;
  if (phone.length <= 8) return `${phone.slice(0, 2)}****${phone.slice(-2)}`;
  return `${phone.slice(0, 3)}-****-${phone.slice(-4)}`;
}

function hash(value) {
  const secret = process.env.APP_SECRET || process.env.OPENAI_API_KEY || "chajabot-local-dev";
  return crypto.createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

function deriveUserType(subject) {
  if (subject === "staff") return "staff";
  if (subject === "participant") return "participant_pending";
  return "guest";
}

async function upsertSupabaseUser(payload) {
  const result = await supabaseRequest("/app_users?on_conflict=identity_hash", {
    method: "POST",
    body: payload,
    prefer: "resolution=merge-duplicates,return=representation",
  });
  if (!result.configured) return null;
  if (!result.ok) return { error: "Supabase upsert failed", status: result.status, detail: result.detail };
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return { row };
}

async function getParticipant(participantId) {
  if (!participantId) return null;
  const result = await supabaseRequest(
    `/participants?id=eq.${encodeEq(participantId)}&active=eq.true&select=id,display_name,phone_last4,phone_masked,group_id,session_id`
  );
  if (!result.configured || !result.ok) return null;
  return Array.isArray(result.data) ? result.data[0] || null : null;
}

async function isParticipantLocked(participantId) {
  if (!participantId) return false;
  const result = await supabaseRequest(
    `/app_users?participant_id=eq.${encodeEq(participantId)}&last_seen_at=gte.${encodeEq(PARTICIPANT_LOCK_AFTER)}&select=id&limit=1`
  );
  if (!result.configured || !result.ok) return false;
  return Array.isArray(result.data) && result.data.length > 0;
}

module.exports = async function loginHandler(req, res) {
  if (req.method && !["POST", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const body = readBody(req);
  const participant = await getParticipant(clean(body.participantId, 80));
  const displayName = normalizeName(participant?.display_name || body.name || body.displayName);
  const phone = participant ? "" : normalizePhone(body.phone);
  const subject = SUBJECTS.has(body.subject) ? body.subject : "general";

  if (displayName.length < 2) return sendJson(res, 400, { error: "Name is required" });
  if (!participant && phone.length < 8) return sendJson(res, 400, { error: "Valid phone number is required" });
  if (participant && (await isParticipantLocked(participant.id))) {
    return sendJson(res, 409, {
      error: "Participant already selected",
      message: "이미 선택된 성함이에요. 담당자에게 말씀해 주세요.",
    });
  }

  const phoneLast4 = participant?.phone_last4 || phone.slice(-4);
  const phoneMasked = participant?.phone_masked || maskPhone(phone);
  const identityHash = participant ? hash(`participant:${participant.id}`) : hash(`${displayName.toLowerCase()}:${phone}`);
  const phoneHash = participant ? hash(`participant-phone:${participant.id}:${phoneLast4}`) : hash(phone);
  const userId = `user_${identityHash.slice(0, 18)}`;
  const userType = participant ? "participant" : deriveUserType(subject);
  const now = new Date().toISOString();
  const baseUser = {
    userId,
    displayName,
    phoneMasked,
    phoneLast4,
    subject,
    userType,
    participantId: participant?.id || null,
    matched: Boolean(participant),
  };

  const dbPayload = {
    id: userId,
    identity_hash: identityHash,
    phone_hash: phoneHash,
    phone_last4: phoneLast4,
    phone_masked: phoneMasked,
    display_name: displayName,
    subject,
    user_type: userType,
    matched: Boolean(participant),
    last_seen_at: now,
  };
  if (participant) {
    dbPayload.participant_id = participant.id;
    dbPayload.group_id = participant.group_id || null;
    dbPayload.session_id = participant.session_id || null;
  }

  try {
    const result = await upsertSupabaseUser(dbPayload);
    if (!result) {
      return sendJson(res, 200, {
        ...baseUser,
        dbConfigured: false,
        storage: "local-only",
        message: "DB is not configured; local login only",
      });
    }
    if (result.error) {
      return sendJson(res, 200, {
        ...baseUser,
        dbConfigured: true,
        storage: "local-fallback",
        warning: result,
      });
    }
    return sendJson(res, 200, {
      ...baseUser,
      userId: result.row?.id || userId,
      userType: result.row?.user_type || userType,
      matched: Boolean(result.row?.matched),
      participantId: result.row?.participant_id || participant?.id || null,
      dbConfigured: true,
      storage: "supabase",
    });
  } catch (error) {
    return sendJson(res, 200, {
      ...baseUser,
      dbConfigured: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
      storage: "local-fallback",
      warning: { error: "Login DB request failed" },
    });
  }
};
