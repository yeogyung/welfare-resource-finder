const fs = require("fs");
const path = require("path");
const engine = require("../public/js/chajabot-engine.js");

let cachedResources = null;

function loadResources() {
  if (cachedResources) return cachedResources;
  const file = path.join(process.cwd(), "public", "data", "welfare-resources.json");
  cachedResources = JSON.parse(fs.readFileSync(file, "utf8"));
  return cachedResources;
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

module.exports = function recommendHandler(req, res) {
  if (req.method && !["GET", "POST", "OPTIONS"].includes(req.method)) {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const body = readBody(req);
  const query = body.query || req.query?.q || req.query?.query || "";
  const category = body.category || req.query?.category || "all";
  const limit = Number(body.limit || req.query?.limit || 5);
  const resources = loadResources();
  const payload = engine.recommend(resources, { query, category, limit });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify({
    generatedAt: new Date().toISOString(),
    resourceCount: resources.length,
    ...payload,
  }));
};
