function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

module.exports = async function configHandler(req, res) {
  if (req.method && !["GET", "OPTIONS"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  const ga4MeasurementId = String(process.env.GA4_MEASUREMENT_ID || "").trim();
  return sendJson(res, 200, {
    ga4MeasurementId: /^G-[A-Z0-9]+$/i.test(ga4MeasurementId) ? ga4MeasurementId : "",
  });
};
