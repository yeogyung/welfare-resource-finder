const adminState = {
  resources: [],
  stats: null,
  lastRows: [],
  logs: null,
};

const CATEGORY_ORDER = [
  ["all", "전체"],
  ["emergency", "응급·안전"],
  ["care", "돌봄·생활"],
  ["health", "건강·의료"],
  ["money", "경제·일자리"],
  ["housing", "주거"],
  ["learning", "배움"],
  ["culture", "문화"],
];

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

const SYNONYMS = [
  ["쓰러", "응급 안전 위기 독거노인 장애인 응급안전안심"],
  ["혼자", "독거 고립 외로움 말벗 맞춤돌봄 사회참여"],
  ["외로", "고립 사회참여 모임 복지관 문화 노인맞춤돌봄"],
  ["생활비", "경제 생계 연금 현금 수당 주택담보"],
  ["돈", "경제 생계 연금 현금 수당 일자리"],
  ["집", "주거 환경개선 수리 난방 에너지 주택"],
  ["아파", "건강 의료 병원 검진 치료비 보건"],
  ["병원", "건강 의료 검진 수술 치료비 보건"],
  ["치매", "건강 보건 치매 상담"],
  ["눈", "안검진 개안수술 건강 의료"],
  ["무릎", "무릎인공관절 수술 의료 건강"],
  ["스마트폰", "디지털 교육 컴퓨터 금융"],
  ["컴퓨터", "디지털 교육 스마트폰"],
  ["배우", "교육 문화 디지털 평생교육"],
  ["모임", "문화 여가 사회참여 복지관"],
  ["식사", "생활지원 급식 도시락 반찬 돌봄"],
];

document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {
  await loadData();
  renderAdminStats();
  document.getElementById("runEval").addEventListener("click", runEvaluation);
  document.getElementById("downloadEval").addEventListener("click", downloadEvaluation);
  document.getElementById("loadLogs").addEventListener("click", loadAdminLogs);
  document.getElementById("downloadLogs").addEventListener("click", downloadAdminLogs);
}

async function loadData() {
  const [resources, stats] = await Promise.all([
    fetch("./public/data/welfare-resources.json").then((res) => res.json()),
    fetch("./public/data/resource-stats.json").then((res) => res.json()),
  ]);
  adminState.resources = resources;
  adminState.stats = stats;
}

function renderAdminStats() {
  const stats = adminState.stats;
  const categoryCount = Object.keys(stats.byCategory).length;
  document.getElementById("adminStats").innerHTML = `
    <div class="admin-stat"><b>${stats.total}</b><span>통합 복지자원</span></div>
    <div class="admin-stat"><b>${Object.keys(stats.bySource).length}</b><span>DB 출처</span></div>
    <div class="admin-stat"><b>${categoryCount}</b><span>상황 분류</span></div>
    <div class="admin-stat"><b>${EVAL_SET.length}</b><span>내부 평가 문항</span></div>
  `;
}

function runEvaluation() {
  const rows = EVAL_SET.map((test) => {
    const results = searchResources(test.q, "all", 3);
    const joined = normalize(results.map((item) => `${item.name} ${item.description} ${item.method} ${item.contact} ${item.url} ${item.categoryLabel}`).join(" "));
    const keywordHit = test.expect.some((word) => joined.includes(normalize(word)));
    const categoryHit = results.some((item) => item.category === test.category);
    const faithfulness = results.filter((item) => item.url && item.method && !/010-|핸드폰|이메일/.test(item.method)).length;
    return { ...test, results, keywordHit, categoryHit, faithfulness };
  });
  adminState.lastRows = rows;

  const top3 = rows.filter((row) => row.keywordHit || row.categoryHit).length;
  const category = rows.filter((row) => row.categoryHit).length;
  const faithful = rows.reduce((sum, row) => sum + row.faithfulness, 0);
  const totalCards = rows.reduce((sum, row) => sum + row.results.length, 0);

  document.getElementById("evalSummary").innerHTML = `
    <div class="eval-metric"><b>${Math.round((top3 / rows.length) * 100)}%</b><span>Top-3 적합</span></div>
    <div class="eval-metric"><b>${Math.round((category / rows.length) * 100)}%</b><span>분류 적합</span></div>
    <div class="eval-metric"><b>${Math.round((faithful / totalCards) * 100)}%</b><span>근거 충실</span></div>
  `;
  document.getElementById("evalList").innerHTML = rows.map(renderEvalItem).join("");
  document.getElementById("downloadEval").disabled = false;
}

function renderEvalItem(row, index) {
  const names = row.results.map((item) => item.name).join(", ");
  const status = row.keywordHit || row.categoryHit ? "통과" : "검토";
  return `
    <div class="eval-item">
      <strong>${index + 1}. ${escapeHtml(row.q)}</strong>
      <p>기대: ${escapeHtml(row.expect.join(" / "))} · 기대 분류: ${escapeHtml(categoryLabel(row.category))}</p>
      <p>Top-3: ${escapeHtml(names || "없음")}</p>
      <p>판정: ${status} · 키워드 ${row.keywordHit ? "통과" : "검토"} · 분류 ${row.categoryHit ? "통과" : "검토"} · Faithfulness ${row.faithfulness}/${row.results.length}</p>
    </div>
  `;
}

function downloadEvaluation() {
  if (!adminState.lastRows.length) return;
  const payload = {
    generatedAt: new Date().toISOString(),
    resourceCount: adminState.resources.length,
    rows: adminState.lastRows.map((row) => ({
      question: row.q,
      expectedKeywords: row.expect,
      expectedCategory: row.category,
      keywordHit: row.keywordHit,
      categoryHit: row.categoryHit,
      faithfulness: row.faithfulness,
      results: row.results.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        source: item.sourceLabel,
        url: item.url,
      })),
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "chajabot-rag-evaluation.json";
  link.click();
  URL.revokeObjectURL(url);
}

function adminToken() {
  return document.getElementById("adminToken").value.trim();
}

function setLogMessage(message, tone = "muted") {
  const box = document.getElementById("adminLogList");
  box.innerHTML = `<div class="admin-log-empty ${tone}">${escapeHtml(message)}</div>`;
}

async function loadAdminLogs() {
  const token = adminToken();
  if (!token) {
    setLogMessage("관리자 토큰을 입력해 주세요.", "warn");
    return;
  }
  document.getElementById("loadLogs").disabled = true;
  document.getElementById("downloadLogs").disabled = true;
  setLogMessage("로그를 불러오는 중입니다...");
  try {
    const response = await fetch("/api/log?admin=1&limit=80", {
      headers: { "x-admin-token": token },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "로그 조회 실패");
    adminState.logs = data;
    renderAdminLogs(data);
    document.getElementById("downloadLogs").disabled = false;
  } catch (error) {
    adminState.logs = null;
    setLogMessage(error.message || "로그를 불러오지 못했습니다.", "warn");
    document.getElementById("adminLogSummary").innerHTML = "";
  } finally {
    document.getElementById("loadLogs").disabled = false;
  }
}

function renderAdminLogs(data) {
  const conversations = data.conversations || [];
  const messages = data.messages || [];
  const usageEvents = data.usageEvents || [];
  const users = data.users || [];
  const todayConversations = conversations.filter((row) => isToday(row.created_at || row.updated_at)).length;
  const todayMessages = messages.filter((row) => isToday(row.created_at)).length;
  const todayUsageEvents = usageEvents.filter((row) => isToday(row.created_at)).length;
  const todayUsers = users.filter((row) => isToday(row.last_seen_at || row.created_at)).length;
  document.getElementById("adminLogSummary").innerHTML = `
    <div class="admin-log-metric"><b>${conversations.length}</b><span>대화 · 오늘 ${todayConversations}</span></div>
    <div class="admin-log-metric"><b>${messages.length}</b><span>메시지 · 오늘 ${todayMessages}</span></div>
    <div class="admin-log-metric"><b>${usageEvents.length}</b><span>이벤트/사용량 · 오늘 ${todayUsageEvents}</span></div>
    <div class="admin-log-metric"><b>${users.length}</b><span>사용자 · 오늘 ${todayUsers}</span></div>
  `;
  const rows = [
    ...messages.slice(0, 36).map((row) => ({
      type: row.role === "assistant" ? "찾아봇 답변" : "사용자 입력",
      title: clipText(row.content, 120),
      meta: `${formatDate(row.created_at)} · ${row.mode || "chat"} · ${row.user_id || ""}`,
      time: Date.parse(row.created_at || "") || 0,
    })),
    ...usageEvents.slice(0, 24).map((row) => ({
      type: row.feature && row.feature.startsWith("event:") ? "클릭 로그" : "사용량",
      title: row.feature || "usage_event",
      meta: `${formatDate(row.created_at)} · ${row.provider || "-"} ${row.model || ""} · ${row.user_id || ""}`,
      time: Date.parse(row.created_at || "") || 0,
    })),
  ].sort((a, b) => b.time - a.time).slice(0, 50);
  if (!rows.length) {
    setLogMessage(data.dbConfigured === false ? "DB 연결값을 먼저 확인해 주세요." : "표시할 로그가 아직 없습니다.");
    return;
  }
  document.getElementById("adminLogList").innerHTML = rows.map((row) => `
    <div class="admin-log-item">
      <strong>${escapeHtml(row.type)}</strong>
      <p>${escapeHtml(row.title || "-")}</p>
      <span>${escapeHtml(row.meta || "")}</span>
    </div>
  `).join("");
}

async function downloadAdminLogs() {
  const token = adminToken();
  if (!token) {
    setLogMessage("관리자 토큰을 입력해 주세요.", "warn");
    return;
  }
  try {
    const response = await fetch("/api/log?admin=1&limit=300&format=csv", {
      headers: { "x-admin-token": token },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "CSV 다운로드 실패");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "chajabot-admin-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    setLogMessage(error.message || "CSV를 내려받지 못했습니다.", "warn");
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isToday(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function clipText(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function searchResources(query = "", category = "all", limit = 20) {
  return ChajabotEngine.searchResources(adminState.resources, { query, category, limit });
}

function scoreResource(item, query, category) {
  if (category !== "all" && item.category !== category) return 0;
  const text = normalize(`${item.searchText} ${item.categoryLabel} ${item.sourceLabel}`);
  const tokens = tokenize(query);
  let score = item.priority / 40;
  if (category !== "all") score += 5;
  tokens.forEach((token) => {
    if (!token) return;
    if (text.includes(token)) score += token.length > 1 ? 4 : 1;
    if (normalize(item.name).includes(token)) score += 6;
    if (normalize(item.situation).includes(token)) score += 4;
    if (normalize(item.categoryLabel).includes(token)) score += 3;
  });
  if (isEmergency(query) && item.category === "emergency") score += 35;
  if (isEmergency(query) && /응급|안전|독거|위기/.test(item.searchText)) score += 20;
  if (/광진|복지관|스마트폰|교육|모임/.test(query) && item.source === "gwangjin") score += 12;
  if (/서울|문화|공연|디지털/.test(query) && item.source === "top10") score += 8;
  if (/신청|어디|문의/.test(query) && item.method) score += 5;
  return score;
}

function expandQuery(query) {
  let expanded = normalize(query);
  SYNONYMS.forEach(([key, words]) => {
    if (expanded.includes(normalize(key))) expanded += ` ${normalize(words)}`;
  });
  return expanded;
}

function tokenize(text) {
  return normalize(text)
    .split(/[^0-9a-zA-Z가-힣]+/)
    .filter((token) => token.length >= 2);
}

function isEmergency(text) {
  return /응급|긴급|쓰러|위기|위험|119|혼자.*아파|죽|학대|고독사/.test(text);
}

function categoryLabel(key) {
  return CATEGORY_ORDER.find(([value]) => value === key)?.[1] || key;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
