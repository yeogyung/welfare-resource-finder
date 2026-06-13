const CLOVA_VOICE_ENDPOINT =
  process.env.NCP_CLOVA_VOICE_ENDPOINT ||
  "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts";

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function numberParam(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

module.exports = async function ttsHandler(req, res) {
  if (req.method && !["POST", "OPTIONS"].includes(req.method)) {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const keyId = process.env.NCP_CLOVA_VOICE_KEY_ID;
  const key = process.env.NCP_CLOVA_VOICE_KEY;

  if (!keyId || !key) {
    res.statusCode = 501;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "CLOVA Voice is not configured" }));
  }

  const body = readBody(req);
  const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 1200);

  if (!text) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Text is required" }));
  }

  const params = new URLSearchParams({
    speaker: String(body.speaker || process.env.NCP_CLOVA_VOICE_SPEAKER || "nara"),
    volume: String(numberParam(body.volume, 0, -5, 5)),
    speed: String(numberParam(body.speed, -1, -5, 5)),
    pitch: String(numberParam(body.pitch, 0, -5, 5)),
    format: String(body.format || "mp3"),
    text,
  });

  if (body.emotion) params.set("emotion", String(body.emotion));

  try {
    const response = await fetch(CLOVA_VOICE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-NCP-APIGW-API-KEY-ID": keyId,
        "X-NCP-APIGW-API-KEY": key,
      },
      body: params,
    });

    if (!response.ok) {
      const message = await response.text();
      res.statusCode = response.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "CLOVA Voice request failed", detail: message.slice(0, 500) }));
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", params.get("format") === "wav" ? "audio/wav" : "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.end(audio);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "TTS request failed" }));
  }
};
