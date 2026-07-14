const crypto = require("crypto");

const SUBJECTS = new Set(["general", "participant", "staff"]);

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
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/app_users?on_conflict=identity_hash`;
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    return { error: "Supabase upsert failed", status: response.status, detail: text.slice(0, 700) };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { row };
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
  const displayName = normalizeName(body.name || body.displayName);
  const phone = normalizePhone(body.phone);
  const subject = SUBJECTS.has(body.subject) ? body.subject : "general";

  if (displayName.length < 2) return sendJson(res, 400, { error: "Name is required" });
  if (phone.length < 8) return sendJson(res, 400, { error: "Valid phone number is required" });

  const identityHash = hash(`${displayName.toLowerCase()}:${phone}`);
  const phoneHash = hash(phone);
  const userId = `user_${identityHash.slice(0, 18)}`;
  const userType = deriveUserType(subject);
  const now = new Date().toISOString();
  const baseUser = {
    userId,
    displayName,
    phoneMasked: maskPhone(phone),
    phoneLast4: phone.slice(-4),
    subject,
    userType,
    matched: false,
  };

  const dbPayload = {
    id: userId,
    identity_hash: identityHash,
    phone_hash: phoneHash,
    phone_last4: phone.slice(-4),
    phone_masked: maskPhone(phone),
    display_name: displayName,
    subject,
    user_type: userType,
    matched: false,
    last_seen_at: now,
  };

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
