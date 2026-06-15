(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.ChajabotEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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
    ["위험", "응급 긴급 안전 위기"],
    ["혼자", "독거 고립 외로움 말벗 맞춤돌봄 사회참여"],
    ["외로", "고립 사회참여 모임 복지관 문화 노인맞춤돌봄"],
    ["말벗", "노인맞춤돌봄 사회참여 고립 외로움"],
    ["생활비", "경제 생계 연금 현금 수당 주택담보"],
    ["돈", "경제 생계 연금 현금 수당 일자리"],
    ["일자리", "경제 취업 사회참여 노인일자리"],
    ["집", "주거 환경개선 수리 난방 에너지 주택"],
    ["추워", "난방 에너지 주거 환경개선"],
    ["아파", "건강 의료 병원 검진 치료비 보건"],
    ["병원", "건강 의료 검진 수술 치료비 보건"],
    ["치매", "건강 보건 치매 상담"],
    ["눈", "안검진 개안수술 건강 의료"],
    ["무릎", "무릎인공관절 수술 의료 건강"],
    ["스마트폰", "디지털 교육 컴퓨터 금융"],
    ["키오스크", "디지털 교육 스마트폰 금융"],
    ["컴퓨터", "디지털 교육 스마트폰"],
    ["배우", "교육 문화 디지털 평생교육"],
    ["공연", "문화 여가 전시 티켓 통합문화이용권"],
    ["전시", "문화 여가 공연 티켓 통합문화이용권"],
    ["경로당", "문화 여가 모임 복지관 사회참여"],
    ["모임", "문화 여가 사회참여 복지관 노래교실 독서 경로당"],
    ["친구", "문화 여가 모임 복지관 사회참여 말벗 또래"],
    ["또래", "문화 여가 모임 복지관 사회참여 말벗 친구"],
    ["심심", "문화 여가 모임 복지관 사회참여 경로당"],
    ["무료해", "문화 여가 모임 복지관 사회참여 경로당"],
    ["나들이", "문화 공연 행사 여가 복지관"],
    ["취미", "문화 여가 프로그램 평생교육"],
    ["게이트볼", "운동 체육 생활체육 문화 여가 모임 경로당"],
    ["운동", "체육 생활체육 건강 여가 문화 프로그램"],
    ["체육", "운동 생활체육 건강 여가 문화 프로그램"],
    ["스포츠", "운동 체육 생활체육 여가 문화 프로그램"],
    ["산책", "운동 건강 여가 문화 모임"],
    ["탁구", "운동 체육 생활체육 여가 문화 프로그램"],
    ["바둑", "취미 여가 문화 모임 프로그램"],
    ["여가", "문화 공연 전시 모임 복지관 평생교육 취미"],
    ["활동", "문화 여가 사회참여 복지관 평생교육"],
    ["식사", "생활지원 급식 도시락 반찬 돌봄"],
    ["끼니", "생활지원 급식 도시락 반찬 돌봄"],
    ["장보기", "생활지원 돌봄 식사 가사"],
    ["청소", "생활지원 돌봄 가사 방문"],
    ["거동", "방문 재가 돌봄 이동지원 장기요양"],
    ["와주는", "방문 재가 돌봄 이동지원 장기요양"],
  ];

  function recommend(resources, options = {}) {
    const query = String(options.query || "").trim();
    const category = options.category || "all";
    const limit = Number(options.limit || 5);
    const scored = rankResources(resources, query, category)
      .slice(0, limit)
      .map((row, index) => ({
        rank: index + 1,
        score: Math.round(row.score * 10) / 10,
        reasons: row.reasons,
        item: row.item,
      }));
    const emergency = isEmergency(query);
    const axis = emergency ? "emergency" : inferAxis(query);
    return {
      query,
      axis,
      axisLabel: axisLabel(axis),
      emergency,
      lead: buildLead(query, scored.map((row) => row.item)),
      results: scored,
    };
  }

  function searchResources(resources, options = {}) {
    return recommend(resources, options).results.map((row) => row.item);
  }

  function rankResources(resources, query = "", category = "all") {
    const expanded = expandQuery(query);
    return resources
      .map((item) => scoreResource(item, expanded, query, category))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || b.item.priority - a.item.priority);
  }

  function scoreResource(item, query, originalQuery = query, category = "all") {
    if (category !== "all" && item.category !== category) return { item, score: 0, reasons: [] };
    const text = normalize(`${item.searchText} ${item.categoryLabel} ${item.sourceLabel}`);
    const tokens = tokenize(query);
    const original = normalize(originalQuery);
    const axis = inferAxis(original);
    const materialNeed = /생활비|집|주거|연금|난방|식사|끼니|돌봄|응급|긴급|수술|검진|장보기|청소|치매|병원|건강|약값|치료비/.test(original);
    const reasons = [];
    let score = Number(item.priority || 0) / 40;

    function add(amount, reason) {
      score += amount;
      if (reason && !reasons.includes(reason)) reasons.push(reason);
    }

    if (category !== "all") add(5, "선택한 분류와 일치");

    if (axis === "activity") {
      if (["learning", "culture"].includes(item.category)) add(28, "여가·문화·배움 축과 일치");
      if (/문화|여가|모임|사회참여|평생교육|노래|독서|공연|전시|티켓|봉사|운동|체육|생활체육|게이트볼|요가|필라테스|탁구|바둑|취미/.test(text)) {
        add(16, "활동·참여 관련 표현 포함");
      }
      if (item.source === "gwangjin") add(8, "지역 현장 DB 우선");
      if (/문화생활|문화|공연|전시|여가/.test(original) && /돈|부담|비용/.test(original)) {
        if (item.category === "culture") add(34, "비용 부담이 있는 문화 욕구와 일치");
        if (/통합문화|문화누리|공연|전시|티켓|여가/.test(text)) add(28, "문화비 지원 근거 포함");
        if (/통합문화|문화누리|이용권|바우처/.test(text)) add(54, "문화비 직접 지원 자원");
        if (item.category === "money" && !/통합문화|문화누리|공연|전시|여가/.test(text)) add(-58, "문화 욕구와 직접 관련 낮음");
        if (/종사자|창업|판로|기업/.test(text)) add(-34, "어르신 문화생활 질문과 거리가 있음");
      }
    }

    if (axis === "life" && !["learning", "culture"].includes(item.category)) {
      add(24, "생활형 필요 축과 일치");
    }

    if (axis === "life" && materialNeed && ["learning", "culture"].includes(item.category)) {
      add(-22, "생활형 결핍 신호와 거리가 있음");
    }

    if (axis === "life" && materialNeed && item.category === "emergency" && !isEmergency(original)) {
      add(-14, "긴급 질문이 아니므로 응급 자원 후순위");
    }

    if (/식사|끼니|장보기/.test(original)) {
      if (item.category === "care") add(34, "식사·생활지원 분류 우선");
      if (/급식|도시락|반찬|식사|생활지원|재가|방문/.test(text)) add(24, "식사·생활지원 근거 포함");
      if (/결식|식사배달|무료급식|도시락|반찬/.test(text)) add(42, "끼니 직접 지원 근거 포함");
      if (/상담|요가|체조|수강신청/.test(normalize(item.name))) add(-24, "끼니 직접 지원과 거리가 있음");
    }

    if (/청소|집안일/.test(original)) {
      if (item.category === "care") add(24, "가사·생활지원 분류 우선");
      if (/가사|방문|생활지원|재가|돌봄/.test(text)) add(18, "가사·방문지원 근거 포함");
    }

    if (axis !== "activity" && /생활비|돈|생계|연금|일자리/.test(original)) {
      if (item.category === "money") add(28, "경제·일자리 분류 우선");
      if (/생계|연금|현금|수당|일자리|취업/.test(text)) add(18, "경제지원 근거 포함");
    }

    if (/병원|건강|치매|무릎|눈|약값|검진|치료비/.test(original)) {
      if (item.category === "health") add(28, "건강·의료 분류 우선");
      if (/의료|검진|치매|수술|치료|보건|병원/.test(text)) add(18, "건강·의료 근거 포함");
    }

    if (/집|주거|난방|춥|수리/.test(original)) {
      if (item.category === "housing") add(28, "주거 분류 우선");
      if (/주거|수리|환경개선|에너지|난방/.test(text)) add(18, "주거지원 근거 포함");
    }

    if (/거동|집으로|와주는|방문.*도움|방문.*돌봄/.test(original)) {
      if (item.category === "care") add(36, "방문·재가 돌봄 분류 우선");
      if (/방문|재가|돌봄|장기요양|이동지원/.test(text)) add(28, "방문·재가 돌봄 근거 포함");
      if (/집으로|와주는/.test(original) && /방문|재가|돌봄|장기요양/.test(text)) add(46, "집으로 오는 돌봄 근거 포함");
      if (/노인맞춤돌봄|재가복지|장기요양|방문요양/.test(text)) add(52, "대표 방문돌봄 자원");
      if (/집으로|와주는/.test(original) && /보행기|활동보조기구|감면|바우처|연탄|에너지/.test(text)) add(-58, "방문 서비스 질문과 거리가 있음");
      if (item.category === "housing" && !/방문|재가|돌봄|장기요양/.test(text)) add(-30, "방문돌봄 질문과 거리가 있음");
    }

    if (/갑자기|당장/.test(original) && /생계|어려/.test(original)) {
      if (item.category === "emergency") add(30, "갑작스러운 생계 위기 우선");
      if (/긴급복지|긴급|생계|위기/.test(text)) add(36, "긴급 생계지원 근거 포함");
      if (/긴급복지/.test(normalize(item.name))) add(88, "대표 긴급복지 자원");
      if (/긴급복지.*연계|긴급복지지원|긴급복지 지원/.test(text)) add(60, "긴급복지 근거 포함");
      if (/장기요양|요양인정|가족요양/.test(text) && !/긴급|생계/.test(text)) add(-34, "긴급 생계 질문과 거리가 있음");
    }

    tokens.forEach((token) => {
      if (!token) return;
      if (text.includes(token)) add(token.length > 1 ? 4 : 1, `질문 키워드 '${token}' 포함`);
      if (normalize(item.name).includes(token)) add(6, "서비스명 직접 일치");
      if (normalize(item.situation).includes(token)) add(4, "상황 태그 일치");
      if (normalize(item.categoryLabel).includes(token)) add(3, "분류명 일치");
    });

    if (isEmergency(original) && item.category === "emergency") add(35, "긴급 상황 우선");
    if (isEmergency(original) && /응급|안전|독거|위기/.test(item.searchText)) add(20, "응급·안전 근거 포함");
    if (/광진|복지관|스마트폰|교육|모임|게이트볼|운동|체육|경로당|친구|또래|심심|무료해|여가|문화/.test(original) && item.source === "gwangjin") add(12, "광진구 실증 DB 우선");
    if (/서울|문화|공연|디지털/.test(original) && item.source === "top10") add(8, "서울·문화형 정제 DB 우선");
    if (/신청|어디|문의/.test(original) && item.method) add(5, "신청 방법 제공");

    return { item, score, reasons };
  }

  function buildLead(query, results) {
    if (!results.length) return "지금 DB에서는 딱 맞는 정보를 찾지 못했어요. 주민센터 또는 보건복지상담센터 129에 먼저 문의해 주세요.";
    if (isEmergency(query)) return "위험하거나 긴급한 상황일 수 있어요. 아래 자원을 먼저 확인하고, 지금 바로 위험하면 119 또는 가까운 주민센터에 연락해 주세요.";
    const axis = inferAxis(query);
    const safeQuery = String(query || "").trim();
    if (axis === "activity") {
      return safeQuery
        ? `좋아요. "${safeQuery}"와 관련된 여가·문화·배움 자원을 먼저 찾아봤어요.`
        : "좋아요. 여가·문화·배움 자원을 먼저 찾아봤어요.";
    }
    if (axis === "life") {
      return safeQuery
        ? `말씀해 주셔서 고마워요. "${safeQuery}"와 관련된 생활형 도움 자원을 찾아봤어요.`
        : "말씀해 주셔서 고마워요. 생활형 도움 자원을 찾아봤어요.";
    }
    return safeQuery
      ? `말씀해 주셔서 고마워요. "${safeQuery}"와 관련된 근거 자원을 찾아봤어요.`
      : "말씀해 주셔서 고마워요. 정리된 근거 자원을 찾아봤어요.";
  }

  function expandQuery(query) {
    let expanded = normalize(query);
    SYNONYMS.forEach(([key, words]) => {
      if (expanded.includes(normalize(key))) expanded += ` ${normalize(words)}`;
    });
    return expanded;
  }

  function inferAxis(text) {
    const value = normalize(text);
    if (/배우|교육|공연|전시|문화|여가|모임|독서|글쓰기|노래|합창|봉사|참여|활동|스마트폰|컴퓨터|키오스크|경로당|취미|나들이|운동|체육|생활체육|게이트볼|요가|필라테스|산책|탁구|바둑|친구|또래|심심|무료해|할 일|하는 일|만남/.test(value)) {
      return "activity";
    }
    if (/생활|병원|건강|생활비|집|주거|연금|난방|식사|끼니|돌봄|응급|긴급|수술|검진|장보기|청소|치매/.test(value)) {
      return "life";
    }
    return "unknown";
  }

  function axisLabel(axis) {
    if (axis === "emergency") return "긴급·안전";
    if (axis === "activity") return "욕구 · 여가·문화·배움";
    if (axis === "life") return "필요 · 생활형";
    return "미분류";
  }

  function resourceAxis(item) {
    return resourceAxisKey(item) === "activity" ? "여가·문화·배움" : "생활형";
  }

  function resourceAxisKey(item) {
    return ["learning", "culture"].includes(item.category) ? "activity" : "life";
  }

  function categoryLabel(key) {
    return CATEGORY_ORDER.find(([value]) => value === key)?.[1] || key;
  }

  function tokenize(text) {
    return normalize(text)
      .split(/[^0-9a-zA-Z가-힣]+/)
      .filter((token) => token.length >= 2);
  }

  function isEmergency(text) {
    return /응급|긴급|쓰러|위기|위험|119|혼자.*아파|죽|학대|고독사|당장|갑자기.*(생계|어려)|생계.*어려/.test(text);
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    CATEGORY_ORDER,
    SYNONYMS,
    axisLabel,
    buildLead,
    categoryLabel,
    expandQuery,
    inferAxis,
    isEmergency,
    normalize,
    rankResources,
    recommend,
    resourceAxis,
    resourceAxisKey,
    scoreResource,
    searchResources,
    tokenize,
  };
});
