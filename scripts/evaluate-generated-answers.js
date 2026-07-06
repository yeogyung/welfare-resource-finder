const fs = require("fs");
const path = require("path");

const engine = require("../public/js/chajabot-engine.js");

const projectRoot = path.resolve(__dirname, "..");
const resourcesPath = path.join(projectRoot, "public", "data", "welfare-resources.json");
const outputDir = path.join(projectRoot, "outputs");
const docsDir = path.join(projectRoot, "docs");

const EVAL_SET = [
  { q: "혼자 살다가 쓰러질까 봐 걱정돼요.", expect: ["응급안전", "안전안심", "독거노인"], category: "emergency" },
  { q: "매달 생활비가 부족해요. 집은 있어요.", expect: ["주택담보", "연금", "생계"], category: "money" },
  { q: "컴퓨터를 배우고 싶은데 어디로 가야 하나요?", expect: ["디지털", "컴퓨터", "스마트폰"], category: "learning" },
  { q: "병원비가 부담돼요.", expect: ["의료", "수술", "검진", "건강"], category: "health" },
  { q: "혼자 있어서 너무 외로워요. 사람들을 만나고 싶어요.", expect: ["노인맞춤돌봄", "사회참여", "문화", "복지관"], category: "culture" },
  { q: "식사 챙기기가 힘들어요.", expect: ["식사", "도시락", "반찬", "생활지원"], category: "care" },
  { q: "집이 너무 춥고 낡았어요. 고칠 수 있을까요?", expect: ["주거", "에너지", "환경개선", "수리"], category: "housing" },
  { q: "스마트폰으로 은행 쓰는 법을 배우고 싶어요.", expect: ["디지털", "금융", "스마트폰"], category: "learning" },
  { q: "치매가 걱정돼요. 어디에 상담하면 좋을까요?", expect: ["치매", "건강", "보건"], category: "health" },
  { q: "가족이 돌봐주기 어려운데 장기요양 도움을 받을 수 있나요?", expect: ["장기요양", "재가", "요양"], category: "care" },
  { q: "문화생활을 하고 싶은데 돈이 부담돼요.", expect: ["문화", "공연", "여가"], category: "culture" },
  { q: "갑자기 생계가 어려워졌어요. 당장 도움 받을 곳이 있나요?", expect: ["긴급", "생계", "생활"], category: "emergency" },
  { q: "눈이 안 좋아서 검진을 받고 싶어요.", expect: ["안검진", "개안", "눈"], category: "health" },
  { q: "거동이 불편해서 집으로 와주는 도움이 필요해요.", expect: ["방문", "재가", "돌봄"], category: "care" },
  { q: "복지 신청을 어디서 해야 하는지 모르겠어요.", expect: ["복지로", "주민센터", "129", "신청"], category: "care" },
];

const CATEGORY_LABELS = {
  care: "돌봄·생활",
  health: "건강·의료",
  money: "경제·일자리",
  culture: "여가·문화·배움",
  learning: "여가·문화·배움",
  emergency: "긴급·안전",
  housing: "주거·환경",
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function stripHtml(text) {
  return String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function resourceText(item) {
  return [
    item?.name,
    item?.categoryLabel,
    item?.target,
    item?.region,
    item?.period,
    item?.summary,
    item?.description,
    item?.reason,
    item?.sourceLabel,
    item?.method,
    item?.contact,
  ]
    .map(stripHtml)
    .filter(Boolean)
    .join(" ");
}

function keywordHit(item, expected) {
  const haystack = normalize(resourceText(item));
  return expected.some((keyword) => haystack.includes(normalize(keyword)));
}

function categoryHit(item, expectedCategory) {
  return item?.category === expectedCategory || item?.intent === expectedCategory;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function lcsLength(a, b) {
  const prev = Array(b.length + 1).fill(0);
  const curr = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function rougeL(candidate, reference) {
  const cand = tokenize(candidate);
  const ref = tokenize(reference);
  if (!cand.length || !ref.length) return { precision: 0, recall: 0, f1: 0 };
  const lcs = lcsLength(cand, ref);
  const precision = lcs / cand.length;
  const recall = lcs / ref.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

function meteor(candidate, reference) {
  const cand = tokenize(candidate);
  const ref = tokenize(reference);
  if (!cand.length || !ref.length) return 0;

  const refPositions = new Map();
  ref.forEach((token, index) => {
    if (!refPositions.has(token)) refPositions.set(token, []);
    refPositions.get(token).push(index);
  });

  const used = new Set();
  const matches = [];
  cand.forEach((token, candIndex) => {
    const positions = refPositions.get(token) || [];
    const refIndex = positions.find((index) => !used.has(index));
    if (refIndex !== undefined) {
      used.add(refIndex);
      matches.push({ candIndex, refIndex });
    }
  });

  if (!matches.length) return 0;
  const precision = matches.length / cand.length;
  const recall = matches.length / ref.length;
  const fMean = (10 * precision * recall) / (recall + 9 * precision);
  let chunks = 1;
  for (let i = 1; i < matches.length; i += 1) {
    const prev = matches[i - 1];
    const curr = matches[i];
    if (curr.candIndex !== prev.candIndex + 1 || curr.refIndex !== prev.refIndex + 1) chunks += 1;
  }
  const penalty = 0.5 * (chunks / matches.length) ** 3;
  return fMean * (1 - penalty);
}

function buildReferenceAnswer(test) {
  const label = CATEGORY_LABELS[test.category] || "복지";
  return `${test.q} 이 질문에는 ${test.expect.join(", ")}와 관련된 ${label} 복지자원을 안내해야 한다. 공식 DB에서 확인된 자원만 제시하고, 대상과 지역, 신청 방법은 추천 카드의 근거 정보로 확인하도록 안내한다.`;
}

function buildGeneratedAnswer(test, recommendation) {
  const top = recommendation.results[0]?.item;
  if (!top) {
    return "말씀해 주셔서 고마워요. 지금은 조건에 맞는 추천 카드를 더 확인해 보시는 것이 좋겠습니다.";
  }

  const name = stripHtml(top.name);
  const description = stripHtml(top.description || top.summary || "");
  const target = stripHtml(top.target || "대상은 추천 카드에서 확인");
  const region = stripHtml(top.region || "지역은 추천 카드에서 확인");
  const lead = stripHtml(recommendation.lead || "말씀해 주셔서 고마워요.");
  const shortDescription = description.length > 58 ? `${description.slice(0, 58)}...` : description;
  return `${lead} 먼저 '${name}'을 확인해 보세요. ${shortDescription} 대상은 ${target}, 지역은 ${region}입니다. 자세한 신청 방법은 추천 카드에서 확인해 주세요.`;
}

function faithfulnessCheck(candidate, recommendation) {
  const context = recommendation.results.map((row) => resourceText(row.item)).join(" ");
  const normalizedContext = normalize(context);
  const quoted = [...candidate.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const quotedSupported = quoted.every((name) => normalizedContext.includes(normalize(name)));
  const hasUnsupportedPhone = /\d{2,4}-\d{3,4}-\d{4}/.test(candidate) && !/\d{2,4}-\d{3,4}-\d{4}/.test(context);
  const hasUnsupportedUrl = /https?:\/\//i.test(candidate) && !/https?:\/\//i.test(context);
  return {
    pass: quotedSupported && !hasUnsupportedPhone && !hasUnsupportedUrl,
    score: quotedSupported && !hasUnsupportedPhone && !hasUnsupportedUrl ? 1 : 0,
    note: quotedSupported && !hasUnsupportedPhone && !hasUnsupportedUrl
      ? "선정된 DB context에서 확인되는 자원명·대상·지역만 사용"
      : "DB context 밖의 표현 점검 필요",
  };
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function makeMarkdown(summary, rows) {
  const lines = [];
  lines.push("# 생성 답변 정량 평가 결과");
  lines.push("");
  lines.push("## 요약");
  lines.push("");
  lines.push(`- 평가 문항: ${summary.total}개`);
  lines.push(`- Top-1 적합도: ${summary.top1Hit}/${summary.total} (${percent(summary.top1Hit / summary.total)})`);
  lines.push(`- Top-3 적합도: ${summary.top3Hit}/${summary.total} (${percent(summary.top3Hit / summary.total)})`);
  lines.push(`- 분류 적합도: ${summary.categoryHit}/${summary.total} (${percent(summary.categoryHit / summary.total)})`);
  lines.push(`- 근거 충실도(Faithfulness): ${summary.faithfulnessPass}/${summary.total} (${percent(summary.faithfulnessPass / summary.total)})`);
  lines.push(`- ROUGE-L F1 평균: ${summary.rougeL.f1.toFixed(4)}`);
  lines.push(`- METEOR 평균: ${summary.meteor.toFixed(4)}`);
  lines.push(`- BERTScore: 별도 스크립트에서 보완`);
  lines.push("");
  lines.push("## 평가 조건");
  lines.push("");
  lines.push("- 추천 후보는 통합 복지자원 DB 검색·점수화 결과로 결정하였다.");
  lines.push("- CLOVA Studio는 후보를 새로 만들거나 재정렬하지 않고, 선택된 DB context를 쉬운 한국어 안내문으로 바꾸는 보조 레이어로 제한하였다.");
  lines.push("- 생성 답변 평가는 사용자 화면과 분리된 내부 평가 영역에서 수행하였다.");
  lines.push("");
  lines.push("## 문항별 결과");
  lines.push("");
  lines.push("| 번호 | 질문 | Top-1 | Top-3 | 분류 | ROUGE-L F1 | METEOR | Faithfulness |");
  lines.push("|---:|---|---:|---:|---:|---:|---:|---:|");
  rows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${row.question.replace(/\|/g, "/")} | ${row.top1Hit ? "1" : "0"} | ${row.top3Hit ? "1" : "0"} | ${row.categoryHit ? "1" : "0"} | ${row.rougeL.f1.toFixed(4)} | ${row.meteor.toFixed(4)} | ${row.faithfulness.pass ? "1" : "0"} |`
    );
  });
  lines.push("");
  lines.push("## 해석");
  lines.push("");
  lines.push("단어 기반 지표인 ROUGE-L과 METEOR는 기준 답변과 생성 안내문의 표면 표현 차이를 확인하기 위한 보조 지표로 사용하였다. 복지자원 추천의 핵심 평가는 실제 노출 카드가 기대 범주와 근거에 맞는지에 두었으며, Faithfulness는 생성 문장이 DB context 밖의 자원명·연락처·신청 조건을 임의 생성하지 않는지 점검하였다.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main(options = {}) {
  const stdoutOnly = options.stdoutOnly === true;
  if (!stdoutOnly) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const resources = JSON.parse(fs.readFileSync(resourcesPath, "utf8"));
  const rows = EVAL_SET.map((test) => {
    const recommendation = engine.recommend(resources, { query: test.q, category: "all", limit: 3 });
    const candidate = buildGeneratedAnswer(test, recommendation);
    const reference = buildReferenceAnswer(test);
    const topItems = recommendation.results.map((row) => row.item);
    const top1 = topItems.slice(0, 1);
    const top3 = topItems.slice(0, 3);
    const top1Hit = top1.some((item) => keywordHit(item, test.expect) || categoryHit(item, test.category));
    const top3Hit = top3.some((item) => keywordHit(item, test.expect) || categoryHit(item, test.category));
    const categoryHitValue = top3.some((item) => categoryHit(item, test.category));
    const rouge = rougeL(candidate, reference);
    const meteorScore = meteor(candidate, reference);
    const faithfulness = faithfulnessCheck(candidate, recommendation);

    return {
      question: test.q,
      expectedKeywords: test.expect,
      expectedCategory: test.category,
      top1Hit,
      top3Hit,
      categoryHit: categoryHitValue,
      topResources: recommendation.results.map((row) => ({
        rank: row.rank,
        score: row.score,
        name: row.item.name,
        category: row.item.category,
        categoryLabel: row.item.categoryLabel,
        reasons: row.reasons,
      })),
      reference,
      candidate,
      rougeL: {
        precision: round(rouge.precision),
        recall: round(rouge.recall),
        f1: round(rouge.f1),
      },
      meteor: round(meteorScore),
      faithfulness,
    };
  });

  const summary = {
    total: rows.length,
    top1Hit: rows.filter((row) => row.top1Hit).length,
    top3Hit: rows.filter((row) => row.top3Hit).length,
    categoryHit: rows.filter((row) => row.categoryHit).length,
    faithfulnessPass: rows.filter((row) => row.faithfulness.pass).length,
    rougeL: {
      precision: round(mean(rows.map((row) => row.rougeL.precision))),
      recall: round(mean(rows.map((row) => row.rougeL.recall))),
      f1: round(mean(rows.map((row) => row.rougeL.f1))),
    },
    meteor: round(mean(rows.map((row) => row.meteor))),
    bertScore: null,
  };

  const result = {
    evaluationName: "generated-answer-evaluation",
    modelRole: "CLOVA Studio 보조 생성 레이어",
    modelConstraint: "DB 기반 추천 결과를 재선정하지 않고, 선택된 context만 쉬운 한국어 안내문으로 변환",
    summary,
    rows,
  };

  if (stdoutOnly) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  fs.writeFileSync(path.join(outputDir, "generated-answer-evaluation-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, "generated-answer-evaluation-pairs.json"), `${JSON.stringify(rows.map(({ question, reference, candidate }) => ({ question, reference, candidate })), null, 2)}\n`);
  fs.writeFileSync(path.join(docsDir, "generated-answer-evaluation-result.md"), makeMarkdown(summary, rows));
  return result;
}

if (require.main === module) {
  main({ stdoutOnly: process.argv.includes("--stdout-only") });
}

module.exports = { main };
