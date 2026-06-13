const state = {
  resources: [],
  stats: null,
  saved: {},
  currentCategory: "all",
  largeText: false,
  recognition: null,
  listening: false,
  tts: false,
};

const STORAGE_SAVED = "chajabot_saved_resources_v1";
const STORAGE_TEXT = "chajabot_large_text_v1";
const STORAGE_TTS = "chajabot_tts_enabled_v1";
const GREETING_TEXT = "안녕하세요. 저는 찾아봇이에요. 오늘 생활하면서 불편한 점이 있으셨나요? 말로 편하게 들려주시면 맞는 복지 정보를 찾아드릴게요.";

const QUICK_QUESTIONS = [
  "생활에 도움이 필요해요",
  "그냥 이야기하고 싶어요",
  "병원·건강이 궁금해요",
  "뭔가 배우거나 모임을 찾고 싶어요",
  "혼자 살다가 쓰러질까 봐 걱정돼요",
  "매달 생활비가 부족해요. 집은 있어요",
];

const FOLLOW_UPS = {
  "생활에 도움이 필요해요": ["식사 챙기기가 힘들어요", "집 수리가 필요해요", "생활비가 부족해요", "긴급하게 도움이 필요해요"],
  "그냥 이야기하고 싶어요": ["혼자 있어서 외로워요", "사람들을 만나고 싶어요", "집에서 할 취미가 있을까요", "가까운 모임을 찾아줘"],
  "병원·건강이 궁금해요": ["병원비가 부담돼요", "눈 검진을 받고 싶어요", "치매가 걱정돼요", "무릎 수술비가 걱정돼요"],
  "뭔가 배우거나 모임을 찾고 싶어요": ["스마트폰을 배우고 싶어요", "컴퓨터를 배우고 싶어요", "운동 프로그램이 궁금해요", "문화생활을 하고 싶어요"],
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
  ["모임", "문화 여가 사회참여 복지관"],
  ["식사", "생활지원 급식 도시락 반찬 돌봄"],
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  restoreState();
  bindEvents();
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
  } catch {
    state.saved = {};
  }
  document.getElementById("app").classList.toggle("large-text", state.largeText);
  const ttsToggle = document.getElementById("ttsToggle");
  ttsToggle?.classList.toggle("active", state.tts);
  if (ttsToggle) ttsToggle.textContent = state.tts ? "음성 안내 켜짐" : "음성 안내 켜기";
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
  document.getElementById("exploreSearch").addEventListener("click", () => {
    const query = document.getElementById("exploreInput").value.trim();
    renderResourceList(searchResources(query, state.currentCategory, 40));
  });
  document.getElementById("exploreInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("exploreSearch").click();
    }
  });
  document.getElementById("fontToggle").addEventListener("click", () => {
    state.largeText = !state.largeText;
    localStorage.setItem(STORAGE_TEXT, state.largeText ? "1" : "0");
    document.getElementById("app").classList.toggle("large-text", state.largeText);
    showToast(state.largeText ? "큰 글자로 볼게요" : "기본 글자로 볼게요");
  });
  document.getElementById("micButton").addEventListener("click", startListening);
  document.getElementById("greetingButton").addEventListener("click", () => {
    navigate("chat");
    const thread = document.getElementById("thread");
    thread.innerHTML = "";
    addBotMessage(GREETING_TEXT);
    renderChoices(["생활에 도움이 필요해요", "병원·건강이 궁금해요", "그냥 이야기하고 싶어요"]);
    if (!state.tts) speak(GREETING_TEXT, true);
  });
  document.getElementById("ttsToggle").addEventListener("click", () => {
    state.tts = !state.tts;
    localStorage.setItem(STORAGE_TTS, state.tts ? "1" : "0");
    document.getElementById("ttsToggle").classList.toggle("active", state.tts);
    document.getElementById("ttsToggle").textContent = state.tts ? "음성 안내 켜짐" : "음성 안내 켜기";
    showToast(state.tts ? "찾아봇 말풍선을 읽어드릴게요" : "음성 안내를 껐어요");
    if (!state.tts) window.speechSynthesis?.cancel();
  });
}

function navigate(name) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.getElementById(`screen-${name}`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === name);
  });
  if (name === "saved") renderSaved();
}

function renderQuickButtons() {
  const grid = document.getElementById("quickGrid");
  grid.innerHTML = QUICK_QUESTIONS.map((q) => `<button class="quick-button" type="button">${escapeHtml(q)}</button>`).join("");
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
    addBotMessage("어떤 도움이 필요한지 조금 더 알려 주실 수 있어요?");
    renderChoices(FOLLOW_UPS[query]);
    return;
  }
  if (query.includes("그냥 이야기")) {
    addBotMessage("좋아요. 제가 잠깐 이야기 상대가 되어드릴게요. 혼자 있는 시간이 길게 느껴지신다면 모임이나 배움 활동도 같이 찾아드릴 수 있어요.");
    renderChoices(["혼자 있어서 외로워요", "가까운 모임을 찾아줘", "집에서 할 취미가 있을까요"]);
    return;
  }
  addThinkingThen(() => {
    const results = searchResources(query, "all", 5);
    const lead = buildLead(query, results);
    addBotMessage(lead);
    results.slice(0, 4).forEach((item, index) => addResourceCard(item, { evidence: true, rank: index + 1 }));
  });
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
  const avatar = mode === "listening" ? "listening.png" : mode === "curious" ? "curious.png" : "default.png";
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
  if (!results.length) return "지금 DB에서는 딱 맞는 정보를 찾지 못했어요. 주민센터 또는 보건복지상담센터 129에 먼저 문의해 주세요.";
  if (isEmergency(query)) return "위험하거나 긴급한 상황일 수 있어요. 아래 자원을 먼저 확인하고, 지금 바로 위험하면 119 또는 가까운 주민센터에 연락해 주세요.";
  return `말씀해 주셔서 고마워요. "${query}"와 관련된 근거 자원을 찾아봤어요.`;
}

function searchResources(query = "", category = "all", limit = 20) {
  const expanded = expandQuery(query);
  return state.resources
    .map((item) => ({ item, score: scoreResource(item, expanded, category) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.item.priority - a.item.priority)
    .slice(0, limit)
    .map((row) => row.item);
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
  const list = Object.values(state.saved);
  if (!list.length) {
    root.innerHTML = `<div class="empty">아직 찜한 정보가 없어요.<br />찾아봇에게 먼저 물어보세요.</div>`;
    return;
  }
  root.innerHTML = "";
  list.forEach((item) => root.appendChild(resourceCardElement(item)));
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
    document.getElementById("homeMascot").src = "./public/assets/listening.png";
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
    document.getElementById("homeMascot").src = "./public/assets/hand-wave.png";
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
