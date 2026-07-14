function supabaseRestBase(url) {
  const cleanUrl = String(url || "").replace(/\/+$/, "");
  return cleanUrl.endsWith("/rest/v1") ? cleanUrl : `${cleanUrl}/rest/v1`;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return {
    baseUrl: supabaseRestBase(url),
    headers,
  };
}

async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  if (!config) return { configured: false };
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      ...config.headers,
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    return {
      configured: true,
      ok: false,
      status: response.status,
      detail: text.slice(0, 700),
      data,
    };
  }
  return { configured: true, ok: true, status: response.status, data };
}

function encodeEq(value) {
  return encodeURIComponent(String(value || ""));
}

module.exports = {
  getSupabaseConfig,
  supabaseRequest,
  encodeEq,
};
