const state = {
  resources: [],
  stats: null,
  saved: {},
  currentCategory: "all",
  savedAxis: "all",
  largeText: false,
  region: "서울 광진구",
  recognition: null,
  listening: false,
  tts: false,
  homePrompt: "",
};

const STORAGE_SAVED = "chajabot_saved_resources_v1";
const STORAGE_TEXT = "chajabot_large_text_v1";
const STORAGE_TTS = "chajabot_tts_enabled_v1";
const STORAGE_REGION = "chajabot_region_v1";
const HOME_PROMPTS = [
  "오늘은 무엇을 찾아드릴까요?",
  "요즘 어떤 점이 걱정되세요?",
  "지금 가장 필요한 게 있으세요?",
  "요즘 해보고 싶은 게 있으세요?",
  "어떤 걸 배우거나 즐기고 싶으세요?",
  "혼자 지내시기 불편한 점이 있으세요?",
  "오늘은 어떤 도움을 함께 찾아볼까요?",
];
const HOME_PLACEHOLDERS = [
  "예: 혼자 살아서 끼니가 걱정돼요",
  "예: 스마트폰 쓰는 법을 배우고 싶어요",
  "예: 경로당 모임에 나가고 싶어요",
  "예: 병원 가기가 힘들어요",
  "예: 생활비가 부족해요",
  "예: 가까운 곳에서 즐길 거리가 있을까요",
];
const ROOT_QUESTIONS = [
  "무엇을 도와드릴까요? 필요한 것도, 해보고 싶은 것도 편하게 골라주세요.",
  "어떤 이야기든 좋아요. 어떤 점이 궁금하세요?",
  "필요한 복지든 즐길 거리든, 어떤 걸 찾아드릴까요?",
];

const QUICK_GROUPS = [
  {
    axis: "필요 · 생활형",
    items: ["끼니·생활이 걱정돼요", "외롭고 말벗이 필요해요", "건강이 걱정돼요", "생활비가 빠듯해요"],
  },
  {
    axis: "욕구 · 여가·문화·배움",
    items: ["즐길 거리·모임을 찾고 싶어요", "새로운 걸 배우고 싶어요"],
  },
];

const FOLLOW_UPS = {
  "끼니·생활이 걱정돼요": ["끼니를 거를 때가 많아요", "장보기·요리가 힘들어요", "청소·집안일이 버거워요"],
  "외롭고 말벗이 필요해요": ["거의 늘 혼자예요", "가끔 외롭고 말벗이 필요해요", "사람들과 어울리고 싶어요"],
  "건강이 걱정돼요": ["병원 가기가 힘들어요", "약값·치료비가 부담돼요", "기억력·치매가 걱정돼요", "정기 건강검진을 받고 싶어요"],
  "생활비가 빠듯해요": ["매달 생활비가 부족해요", "일자리를 찾고 싶어요", "갑자기 큰돈이 필요해요"],
  "즐길 거리·모임을 찾고 싶어요": ["경로당·모임에 나가고 싶어요", "취미·여가 프로그램을 배우고 싶어요", "나들이·문화 행사에 가보고 싶어요"],
  "새로운 걸 배우고 싶어요": ["스마트폰을 잘 쓰고 싶어요", "키오스크·은행 쓰기가 어려워요", "글·컴퓨터를 배우고 싶어요"],
  "긴급하게 도움이 필요해요": ["지금 많이 위험해요", "평소를 위해 준비하고 싶어요"],
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
  ["공연", "문화 여가 전시 티켓 통합문화이용권"],
  ["전시", "문화 여가 공연 티켓 통합문화이용권"],
  ["경로당", "문화 여가 모임 복지관 사회참여"],
  ["모임", "문화 여가 사회참여 복지관 노래교실 독서 경로당"],
  ["나들이", "문화 공연 행사 여가 복지관"],
  ["취미", "문화 여가 프로그램 평생교육"],
  ["여가", "문화 공연 전시 모임 복지관 평생교육 취미"],
  ["활동", "문화 여가 사회참여 복지관 평생교육"],
  ["식사", "생활지원 급식 도시락 반찬 돌봄"],
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  restoreState();
  bindEvents();
  initHomePrompt();
  renderQuickButtons();
  await loadData();
  renderStats();
  renderFilters();
  renderResourceList(state.resources.slice(0, 20));
  renderSaved();
  setupSpeechRecognition();
}

function restoreState() {
  try {
    state.saved = JSON.parse(localStorage.getItem(STORAGE_SAVED) || "{}");
    state.largeText = localStorage.getItem(STORAGE_TEXT) === "1";
    state.tts = localStorage.getItem(STORAGE_TTS) === "1";
    state.region = localStorage.getItem(STORAGE_REGION) || "서울 광진구";
  } catch {
    state.saved = {};
  }
  document.getElementById("app").classList.toggle("large-text", state.largeText);
  syncSettingsUi();
}

async function loadData() {
  const [resources, stats] = await Promise.all([
    fetch("./public/data/welfare-resources.json").then((res) => res.json()),
    fetch("./public/data/resource-stats.json").then((res) => res.json()),
  ]);
  state.resources = resources;
  state.stats = stats;
}

function bindEvents() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });
  document.getElementById("askForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("queryInput");
    submitQuery(input.value);
    input.value = "";
  });
  document.getElementById("exploreSearch")?.addEventListener("click", () => {
    const query = document.getElementById("exploreInput").value.trim();
    renderResourceList(searchResources(query, state.currentCategory, 40));
  });
  document.getElementById("exploreInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("exploreSearch")?.click();
    }
  });
  document.getElementById("fontToggle").addEventListener("click", () => {
    toggleLargeText();
  });
  document.getElementById("settingsFontToggle")?.addEventListener("click", toggleLargeText);
  document.getElementById("micButton").addEventListener("click", startListening);
  document.querySelectorAll("[data-saved-axis]").forEach((button) => {
    button.addEventListener("click", () => {
      state.savedAxis = button.dataset.savedAxis;
      document.querySelectorAll("[data-saved-axis]").forEach((item) => item.classList.toggle("active", item === button));
      renderSaved();
    });
  });
  document.getElementById("greetingButton").addEventListener("click", () => {
    navigate("chat");
    const thread = document.getElementById("thread");
    thread.innerHTML = "";
    const firstQuestion = sample(ROOT_QUESTIONS);
    const greeting = `안녕하세요. 저는 찾아봇이에요. ${firstQuestion}`;
    addBotMessage(greeting);
    renderChoices([...QUICK_GROUPS.flatMap((group) => group.items), "긴급하게 도움이 필요해요"]);
    if (!state.tts) speak(greeting, true);
  });
  document.getElementById("ttsToggle").addEventListener("click", toggleTts);
  document.getElementById("settingsTtsToggle")?.addEventListener("click", toggleTts);
  document.getElementById("regionButton")?.addEventListener("click", setRegion);
  document.getElementById("shareSavedButton")?.addEventListener("click", shareSaved);
}

function initHomePrompt() {
  const prompt = sample(HOME_PROMPTS);
  state.homePrompt = prompt;
  const promptNode = document.getElementById("homePrompt");
  if (promptNode) promptNode.textContent = prompt;
  const queryInput = document.getElementById("queryInput");
  if (queryInput) queryInput.placeholder = sample(HOME_PLACEHOLDERS);
}

function navigate(name) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.getElementById(`screen-${name}`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === name);
  });
  if (name === "saved") renderSaved();
  if (name === "settings") syncSettingsUi();
}

function renderQuickButtons() {
  const grid = document.getElementById("quickGrid");
  grid.innerHTML = QUICK_GROUPS.map((group) => {
    const buttons = group.items.map((q) => `<button class="quick-button" type="button">${escapeHtml(q)}</button>`).join("");
    return `<section class="quick-section"><h3>${escapeHtml(group.axis)}</h3>${buttons}</section>`;
  }).join("");
  grid.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => submitQuery(button.textContent.trim()));
  });
}

function renderStats() {
  if (!state.stats) return;
  document.getElementById("sourceStrip").innerHTML = `
    <div><b>${state.stats.total}</b><span>근거 자원</span></div>
    <div><b>${Object.keys(state.stats.bySource).length}</b><span>DB 출처</span></div>
    <div><b>${CATEGORY_ORDER.length - 1}</b><span>상황 분류</span></div>
  `;
}

function renderFilters() {
  const row = document.getElementById("filterRow");
  row.innerHTML = CATEGORY_ORDER.map(([key, label]) => {
    return `<button class="filter-chip ${key === state.currentCategory ? "active" : ""}" data-category="${key}" type="button">${label}</button>`;
  }).join("");
  row.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentCategory = button.dataset.category;
      renderFilters();
      const query = document.getElementById("exploreInput").value.trim();
      renderResourceList(searchResources(query, state.currentCategory, 40));
    });
  });
}

function submitQuery(raw) {
  const query = String(raw || "").trim();
  if (!query) {
    showToast("궁금한 내용을 입력해 주세요");
    return;
  }
  navigate("chat");
  const thread = document.getElementById("thread");
  thread.innerHTML = "";
  addUserMessage(query);
  if (FOLLOW_UPS[query]) {
    addBotMessage(followUpPrompt(query));
    renderChoices(FOLLOW_UPS[query]);
    return;
  }
  if (query.includes("그냥 이야기")) {
    addBotMessage("좋아요. 제가 잠깐 이야기 상대가 되어드릴게요. 혼자 있는 시간이 길게 느껴지신다면 모임이나 배움 활동도 같이 찾아드릴 수 있어요.");
    renderChoices(["혼자 있어서 외로워요", "가까운 모임을 찾아줘", "집에서 할 취미가 있을까요"]);
    return;
  }
  addThinkingThen(() => {
    const recommendation = recommendResources(query, "all", 5);
    const results = recommendation.results.map((row) => row.item);
    const lead = recommendation.lead;
    addBotMessage(lead);
    results.slice(0, 4).forEach((item, index) => addResourceCard(item, { evidence: true, rank: index + 1 }));
  });
}

function followUpPrompt(query) {
  if (query === "즐길 거리·모임을 찾고 싶어요") return "어떤 활동을 찾고 계세요?";
  if (query === "새로운 걸 배우고 싶어요") return "무엇을 배우고 싶으세요?";
  if (query === "끼니·생활이 걱정돼요") return "식사나 집안일은 어떻게 지내세요?";
  if (query === "외롭고 말벗이 필요해요") return "혼자 계시는 시간은 어떤가요?";
  if (query === "건강이 걱정돼요") return "어떤 점이 가장 불편하세요?";
  if (query === "생활비가 빠듯해요") return "돈과 관련해 어떤 도움이 필요하세요?";
  if (query === "긴급하게 도움이 필요해요") return "지금 위급한 상황이신가요? 위험하시면 먼저 119에 전화해 주세요.";
  if (/배우|공연|모임|여가|활동|경로당|취미|나들이|문화/.test(query)) return "어떤 활동이나 시간을 보내고 싶으신지 조금 더 알려 주실 수 있어요?";
  if (/병원|건강|치매|무릎|눈|약값|검진/.test(query)) return "건강이나 병원과 관련해 어떤 점이 궁금하신가요?";
  if (/생활비|집|연금|난방|끼니|식사|장보기|청소/.test(query)) return "생활에서 어떤 부분이 가장 신경 쓰이세요?";
  return "어떤 상황인지 조금 더 알려 주실 수 있어요?";
}

function renderChoices(choices) {
  const box = document.createElement("div");
  box.className = "choices";
  box.innerHTML = choices.map((choice) => `<button class="choice-button" type="button">${escapeHtml(choice)}</button>`).join("");
  document.getElementById("thread").appendChild(box);
  box.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => submitQuery(button.textContent.trim()));
  });
  scrollThread();
}

function addUserMessage(text) {
  const msg = document.createElement("div");
  msg.className = "msg user";
  msg.innerHTML = `<div class="user-bubble">${escapeHtml(text)}</div>`;
  document.getElementById("thread").appendChild(msg);
  scrollThread();
}

function addBotMessage(text, mode = "default") {
  const msg = document.createElement("div");
  msg.className = "msg bot";
  const avatar = mode === "listening" ? "state-listening.png" : mode === "curious" ? "state-curious.png" : "state-idle.png";
  msg.innerHTML = `
    <img src="./public/assets/${avatar}" alt="" class="bot-avatar" />
    <div class="bot-stack"><div class="ai-bubble">${escapeHtml(text)}</div></div>
  `;
  document.getElementById("thread").appendChild(msg);
  speak(text);
  scrollThread();
}

function addThinkingThen(callback) {
  const msg = document.createElement("div");
  msg.className = "msg bot";
  msg.innerHTML = `
    <img src="./public/assets/curious.png" alt="" class="bot-avatar" />
    <div class="bot-stack"><div class="ai-bubble"><span class="thinking"><span></span><span></span><span></span></span></div></div>
  `;
  document.getElementById("thread").appendChild(msg);
  scrollThread();
  setTimeout(() => {
    msg.remove();
    callback();
  }, 550);
}

function buildLead(query, results) {
  return ChajabotEngine.buildLead(query, results);
}

function recommendResources(query = "", category = "all", limit = 5) {
  return ChajabotEngine.recommend(state.resources, { query, category, limit });
}

function searchResources(query = "", category = "all", limit = 20) {
  return ChajabotEngine.searchResources(state.resources, { query, category, limit });
}

function scoreResource(item, query, category) {
  if (category !== "all" && item.category !== category) return 0;
  const text = normalize(`${item.searchText} ${item.categoryLabel} ${item.sourceLabel}`);
  const tokens = tokenize(query);
  const axis = inferAxis(query);
  let score = item.priority / 40;
  if (category !== "all") score += 5;
  if (axis === "activity") {
    if (["learning", "culture"].includes(item.category)) score += 28;
    if (/문화|여가|모임|사회참여|평생교육|노래|독서|공연|전시|티켓|봉사/.test(text)) score += 16;
    if (item.source === "gwangjin") score += 8;
  }
  if (axis === "life" && !["learning", "culture"].includes(item.category)) score += 10;
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
  return ChajabotEngine.isEmergency(text);
}

function inferAxis(text) {
  return ChajabotEngine.inferAxis(text);
}

function renderResourceList(list) {
  const root = document.getElementById("resourceList");
  if (!list.length) {
    root.innerHTML = `<div class="empty">조건에 맞는 자원을 찾지 못했어요.<br />검색어를 조금 다르게 입력해 보세요.</div>`;
    return;
  }
  root.innerHTML = "";
  list.forEach((item) => root.appendChild(resourceCardElement(item)));
}

function addResourceCard(item, options = {}) {
  const card = resourceCardElement(item);
  if (options.evidence) card.classList.add("evidence");
  if (isEmergency(item.name + item.searchText)) card.classList.add("emergency");
  document.getElementById("thread").appendChild(card);
  scrollThread();
}

function resourceCardElement(item) {
  const card = document.createElement("article");
  card.className = `resource-card ${item.category}`;
  card.innerHTML = `
    <div><span class="tag ${item.category}">${escapeHtml(item.categoryLabel)}</span></div>
    <h3 class="resource-title">${escapeHtml(item.name)}</h3>
    <p class="resource-desc">${escapeHtml(item.description)}</p>
    <div class="meta-grid">
      <span class="meta-pill">대상 ${escapeHtml(shorten(item.target, 42))}</span>
      <span class="meta-pill">지역 ${escapeHtml(item.region || "확인 필요")}</span>
      <span class="meta-pill">${escapeHtml(resourceAxis(item))}</span>
      <span class="meta-pill">${escapeHtml(item.period || "상세 확인")}</span>
      <span class="meta-pill">${escapeHtml(item.sourceLabel)}</span>
      ${item.requiresCheck ? '<span class="meta-pill">확인 필요</span>' : ""}
    </div>
    <p class="resource-desc"><b>신청</b> ${escapeHtml(shorten(item.method, 110))}</p>
    <div class="card-actions">
      <button class="resource-action secondary" data-save="${item.id}" type="button">${state.saved[item.id] ? "찜됨" : "찜"}</button>
      <button class="resource-action secondary" data-call="${escapeHtml(item.contact)}" type="button">전화</button>
      <button class="resource-action" data-url="${escapeHtml(item.url)}" type="button">상세</button>
    </div>
  `;
  card.querySelector("[data-save]").addEventListener("click", () => toggleSave(item));
  card.querySelector("[data-call]").addEventListener("click", () => showToast(`${item.contact || "129"} 문의로 연결해 주세요`));
  card.querySelector("[data-url]").addEventListener("click", () => {
    if (item.url) window.open(item.url, "_blank", "noopener");
    else showToast("공식 홈페이지 또는 129 문의로 확인해 주세요");
  });
  return card;
}

function toggleSave(item) {
  if (state.saved[item.id]) {
    delete state.saved[item.id];
    showToast("찜을 취소했어요");
  } else {
    state.saved[item.id] = item;
    showToast("찜한 정보에 저장했어요");
  }
  persistSaved();
  renderSaved();
  const visible = document.querySelectorAll(`[data-save="${item.id}"]`);
  visible.forEach((button) => {
    button.textContent = state.saved[item.id] ? "찜됨" : "찜";
  });
}

function persistSaved() {
  localStorage.setItem(STORAGE_SAVED, JSON.stringify(state.saved));
}

function renderSaved() {
  const root = document.getElementById("savedList");
  const list = Object.values(state.saved).filter((item) => state.savedAxis === "all" || resourceAxisKey(item) === state.savedAxis);
  if (!list.length) {
    root.innerHTML = `<div class="empty">아직 찜한 정보가 없어요.<br />찾아봇에게 먼저 물어보세요.</div>`;
    return;
  }
  root.innerHTML = "";
  list.forEach((item) => root.appendChild(resourceCardElement(item)));
}

function resourceAxis(item) {
  return ChajabotEngine.resourceAxis(item);
}

function resourceAxisKey(item) {
  return ChajabotEngine.resourceAxisKey(item);
}

function syncSettingsUi() {
  const ttsToggle = document.getElementById("ttsToggle");
  ttsToggle?.classList.toggle("active", state.tts);
  if (ttsToggle) ttsToggle.textContent = state.tts ? "음성 안내 켜짐" : "음성 안내 켜기";
  const settingsTtsToggle = document.getElementById("settingsTtsToggle");
  settingsTtsToggle?.classList.toggle("active", state.tts);
  if (settingsTtsToggle) settingsTtsToggle.textContent = state.tts ? "켜짐" : "켜기";
  const settingsFontToggle = document.getElementById("settingsFontToggle");
  settingsFontToggle?.classList.toggle("active", state.largeText);
  if (settingsFontToggle) settingsFontToggle.textContent = state.largeText ? "큰 글자" : "기본";
  const regionButton = document.getElementById("regionButton");
  if (regionButton) regionButton.textContent = state.region;
}

function toggleLargeText() {
  state.largeText = !state.largeText;
  localStorage.setItem(STORAGE_TEXT, state.largeText ? "1" : "0");
  document.getElementById("app").classList.toggle("large-text", state.largeText);
  syncSettingsUi();
  showToast(state.largeText ? "큰 글자로 볼게요" : "기본 글자로 볼게요");
}

function toggleTts() {
  state.tts = !state.tts;
  localStorage.setItem(STORAGE_TTS, state.tts ? "1" : "0");
  syncSettingsUi();
  showToast(state.tts ? "찾아봇 말풍선을 읽어드릴게요" : "음성 안내를 껐어요");
  if (!state.tts) window.speechSynthesis?.cancel();
  if (state.tts) speak("음성 안내를 켰어요. 이제 찾아봇의 말을 소리로 읽어드릴게요.", true);
}

function setRegion() {
  const value = window.prompt("지역을 입력해 주세요. 예: 서울 광진구", state.region);
  if (!value) return;
  state.region = value.trim() || "서울 광진구";
  localStorage.setItem(STORAGE_REGION, state.region);
  syncSettingsUi();
  showToast(`지역을 ${state.region}(으)로 설정했어요`);
}

function shareSaved() {
  const list = Object.values(state.saved);
  if (!list.length) {
    showToast("먼저 복지자원을 찜해 주세요");
    return;
  }
  const text = ["[찾아봇] 찜한 복지자원", ...list.map((item, index) => {
    const parts = [`${index + 1}. ${item.name}`];
    if (item.contact) parts.push(`문의 ${item.contact}`);
    if (item.url) parts.push(item.url);
    return parts.join(" / ");
  })].join("\n");
  if (navigator.share) {
    navigator.share({ title: "찾아봇 찜 목록", text }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(text).then(
    () => showToast("찜 목록을 복사했어요"),
    () => showToast("공유 기능을 사용할 수 없어요")
  );
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById("micLabel").textContent = "음성 미지원";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    state.listening = true;
    document.getElementById("micButton").classList.add("listening");
    document.getElementById("micLabel").textContent = "듣는 중";
    document.getElementById("homeMascot").src = "./public/assets/state-listening.png";
  };
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    document.getElementById("queryInput").value = transcript;
    submitQuery(transcript);
  };
  recognition.onerror = () => showToast("음성 인식이 잘 안 됐어요. 다시 눌러 주세요");
  recognition.onend = () => {
    state.listening = false;
    document.getElementById("micButton").classList.remove("listening");
    document.getElementById("micLabel").textContent = "음성으로 묻기";
    document.getElementById("homeMascot").src = "./public/assets/chajabot-full.png";
  };
  state.recognition = recognition;
}

function speak(text, force = false) {
  if (!("speechSynthesis" in window)) return;
  if (!force && !state.tts) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/g, " ").trim());
  utterance.lang = "ko-KR";
  utterance.rate = 0.88;
  utterance.pitch = 1.04;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const koVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith("ko"));
  if (koVoice) utterance.voice = koVoice;
  window.speechSynthesis.speak(utterance);
}

function startListening() {
  if (!state.recognition) {
    showToast("이 브라우저는 음성 인식을 지원하지 않아요");
    return;
  }
  if (state.listening) {
    state.recognition.stop();
    return;
  }
  state.recognition.start();
}

function scrollThread() {
  const thread = document.getElementById("thread");
  requestAnimationFrame(() => {
    thread.scrollTop = thread.scrollHeight;
  });
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(text, limit) {
  const value = String(text || "");
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sample(list) {
  return list[Math.floor(Math.random() * list.length)];
}
