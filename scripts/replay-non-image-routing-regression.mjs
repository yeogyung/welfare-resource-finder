import fs from "node:fs";

const SOURCE = "reports/non-image-flow-replay-2026-07-23.json";
const OUT = "reports/non-image-routing-regression-2026-07-23.json";

function isWeatherIntent(text) {
  const weatherText = String(text || "").replace(/생활비/g, "");
  const hasWeatherSignal =
    /날씨|기온|습도|우산|옷차림|비\s*(?:가|와|오|올|내리|는|도|많이)|비올|눈\s*(?:이|와|오|올|내리|은)|오늘.*(?:더워|추워|덥|춥)|밖.*(?:더워|추워|덥|춥)/.test(weatherText);
  if (!hasWeatherSignal) return false;
  const personalContext =
    /우울|울적|마음|기분|외롭|무릎|무릅|관절|허리|어깨|시려|시리|아파|아프|통증|몸|건강|치료|혈압|불안|걱정|힘들|잠이|잠\s*안|운동/.test(weatherText);
  const strongWeatherRequest =
    /(?:날씨|기온|습도).{0,18}(?:어때|어떤|알려|확인|궁금|조회|볼래|보여|추천|봐줘)|(?:우산|옷차림).{0,18}(?:필요|챙|추천|어떻게|입|가져)/.test(weatherText);
  const directWeatherRequest =
    strongWeatherRequest ||
    /(?:오늘|내일|모레|지금|현재|밖|서울|광진구|복지관).{0,24}(?:날씨|기온|습도|우산|옷차림|더워|추워|덥|춥)/.test(weatherText) ||
    /(?:비|눈)\s*(?:가|이|는)?\s*.{0,8}(?:오나|오나요|올까|올까요|오는지|내려|내리|많이|예보|와\?|와요\?)/.test(weatherText);
  if (personalContext && !strongWeatherRequest) return false;
  return directWeatherRequest;
}

function isImageRequest(text) {
  return /(이미지|그림|사진|로고|포스터|카드|이모티콘|스티커).*(만들어줘|생성해줘|그려줘|꾸며줘|바꿔줘)|(?:만들어줘|그려줘|꾸며줘|바꿔줘).*(이미지|그림|사진|로고|포스터|카드|이모티콘|스티커)/.test(
    String(text || "")
  );
}

function predictFlow(question, oldFlow) {
  if (isWeatherIntent(question)) return "날씨 API";
  if (isImageRequest(question)) return "이미지 생성";
  if (oldFlow === "일상대화 버튼") return oldFlow;
  return "자유대화 AI";
}

const source = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
const rows = source.replays || [];
const failures = [];
const results = rows.map((row) => {
  const oldFlow = row.predicted_flow || "";
  const newFlow = predictFlow(row.question, oldFlow);
  const flags = Array.isArray(row.current_flags) ? row.current_flags : [];
  const wasWeather = oldFlow === "날씨 API";
  const flaggedWeatherMisroute = wasWeather && flags.includes("날씨 키워드 과분류 가능");
  let expected = oldFlow;
  if (flaggedWeatherMisroute) expected = "자유대화 AI";
  if (!wasWeather && newFlow === "날씨 API") {
    failures.push({
      id: row.id,
      question: row.question,
      reason: "기존 비날씨 질문이 새로 날씨 API로 분류됨",
      oldFlow,
      newFlow,
    });
  }
  if (wasWeather && !flaggedWeatherMisroute && newFlow !== "날씨 API") {
    failures.push({
      id: row.id,
      question: row.question,
      reason: "기존 정상 날씨 질문이 날씨 API에서 이탈함",
      oldFlow,
      newFlow,
    });
  }
  if (flaggedWeatherMisroute && newFlow !== "자유대화 AI") {
    failures.push({
      id: row.id,
      question: row.question,
      reason: "날씨 키워드 오분류 케이스가 자유대화로 교정되지 않음",
      oldFlow,
      newFlow,
    });
  }
  return {
    id: row.id,
    question: row.question,
    old_flow: oldFlow,
    new_flow: newFlow,
    expected_flow: expected,
    flags,
    changed: oldFlow !== newFlow,
    assessment: newFlow === expected ? "pass" : "review",
  };
});

const summary = {
  source: SOURCE,
  generated_at: new Date().toISOString(),
  total: rows.length,
  old_weather_count: results.filter((row) => row.old_flow === "날씨 API").length,
  new_weather_count: results.filter((row) => row.new_flow === "날씨 API").length,
  changed_count: results.filter((row) => row.changed).length,
  fixed_weather_misroutes: results.filter(
    (row) => row.old_flow === "날씨 API" && row.new_flow === "자유대화 AI"
  ).length,
  failure_count: failures.length,
};

fs.writeFileSync(OUT, JSON.stringify({ summary, failures, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
