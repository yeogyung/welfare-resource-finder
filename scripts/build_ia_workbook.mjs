import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputPath = new URL("../docs/찾아봇_IA_확정본_2026-06-14.xlsx", import.meta.url);

const workbook = Workbook.create();

function styleHeader(range) {
  range.format = {
    fill: "#3A8F7A",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
  };
}

function styleBody(range) {
  range.format = {
    wrapText: true,
    verticalAlignment: "Top",
    borders: { preset: "all", style: "thin", color: "#D1D5DC" },
  };
}

function addSheet(name, rows, widths = []) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  const rowCount = rows.length;
  const colCount = rows[0].length;
  const range = sheet.getRangeByIndexes(0, 0, rowCount, colCount);
  range.values = rows;
  styleHeader(sheet.getRangeByIndexes(0, 0, 1, colCount));
  styleBody(range);
  sheet.freezePanes.freezeRows(1);
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, rowCount, 1).format.columnWidthPx = width;
  });
  sheet.getRangeByIndexes(0, 0, rowCount, colCount).format.rowHeightPx = 44;
  sheet.getRangeByIndexes(0, 0, 1, colCount).format.rowHeightPx = 34;
  return sheet;
}

addSheet("IA_요약", [
  ["구분", "확정 내용", "결과보고서 반영 문장"],
  ["서비스 정의", "공공·민간 복지자원 DB 기반 어르신 대화형 탐색 서비스", "복지서비스명을 모르는 사용자도 생활 맥락과 하고 싶은 활동을 말하면 적합한 자원을 발견하도록 설계하였다."],
  ["핵심 차별점", "검색이 아니라 대화가 발견의 경로", "기존 포털은 정확한 서비스명 검색이 필요하지만, 찾아봇은 랜덤 질문과 꼬리질문으로 받을 수 있는 자원을 대화 중 발견하게 한다."],
  ["기획 축 1", "필요(생활형): 끼니·돌봄·건강·생계·안전·주거", "결핍을 해결하는 생활형 자원을 질문 흐름에 포함하였다."],
  ["기획 축 2", "욕구(여가·문화·배움): 경로당·모임·취미·나들이·문화행사·디지털 배움", "삶을 넓히는 여가·문화·배움 자원을 별도 축으로 반영하였다."],
  ["평가 분리", "사용자 앱과 내부 RAG/검색 평가 화면 분리", "교수 피드백에 따라 사용자 화면에는 평가 지표를 노출하지 않고 내부 admin에서 Top-3, 분류, Faithfulness를 점검한다."],
], [150, 360, 520]);

addSheet("화면_구조", [
  ["화면 ID", "화면명", "사용자 목적", "주요 UI", "연결 기능"],
  ["HOME-01", "홈", "처음 진입 시 질문을 보고 음성·텍스트·빠른 메뉴 중 선택", "랜덤 첫 질문 7종, 랜덤 입력 예시 6종, 음성 버튼, 빠른 진입 메뉴 6종", "대화 시작, 음성 입력, 질문 듣기"],
  ["CHAT-01", "대화", "꼬리질문을 통해 상황을 구체화하고 추천 카드 확인", "랜덤 대화 첫 질문 3종, 말풍선, 선택지, 추천 카드", "검색/추천, STT/TTS, 찜"],
  ["SAVED-01", "찜", "저장한 복지자원을 다시 확인하고 공유", "찜한 카드 목록, 전화, 상세, 찜 취소", "localStorage 저장, 보호자·활동가 공유"],
  ["SETTING-01", "설정", "실증 환경에 맞게 접근성 및 운영 설정 조정", "큰 글자, 음성 안내, 지역 설정, 공유", "TTS, 글자 크기, 지역 기본값"],
  ["ADMIN-01", "내부 RAG · 검색 평가", "사용자 화면과 분리된 품질 점검", "15문항 평가셋, Top-3 적합도, 분류 적합도, Faithfulness", "평가 결과 JSON 다운로드"],
], [130, 150, 300, 380, 320]);

addSheet("질문_랜덤", [
  ["구분", "문구", "축", "목적"],
  ["홈 질문", "오늘은 무엇을 찾아드릴까요?", "공통", "검색어를 모르는 사용자에게 열린 시작점 제공"],
  ["홈 질문", "요즘 어떤 점이 걱정되세요?", "필요(생활형)", "돌봄·건강·생계 등 결핍성 니즈 발견"],
  ["홈 질문", "지금 가장 필요한 게 있으세요?", "필요(생활형)", "긴급하거나 실제 필요한 도움으로 진입"],
  ["홈 질문", "요즘 해보고 싶은 게 있으세요?", "욕구(여가·문화·배움)", "활동·모임·문화 욕구 발견"],
  ["홈 질문", "어떤 걸 배우거나 즐기고 싶으세요?", "욕구(여가·문화·배움)", "배움·여가 자원으로 진입"],
  ["홈 질문", "혼자 지내시기 불편한 점이 있으세요?", "필요+욕구", "고립감에서 돌봄 또는 모임으로 분기"],
  ["홈 질문", "오늘은 어떤 도움을 함께 찾아볼까요?", "공통", "대화형 탐색의 안내자 역할"],
  ["입력 예시", "예: 혼자 살아서 끼니가 걱정돼요", "필요(생활형)", "식사·돌봄 검색 유도"],
  ["입력 예시", "예: 스마트폰 쓰는 법을 배우고 싶어요", "욕구(여가·문화·배움)", "디지털 배움 검색 유도"],
  ["입력 예시", "예: 경로당 모임에 나가고 싶어요", "욕구(여가·문화·배움)", "모임·사회참여 검색 유도"],
  ["입력 예시", "예: 병원 가기가 힘들어요", "필요(생활형)", "건강·이동·의료 검색 유도"],
  ["입력 예시", "예: 생활비가 부족해요", "필요(생활형)", "생계·연금·경제 지원 검색 유도"],
  ["입력 예시", "예: 가까운 곳에서 즐길 거리가 있을까요", "욕구(여가·문화·배움)", "문화·나들이 검색 유도"],
  ["대화 첫 질문", "무엇을 도와드릴까요? 필요한 것도, 해보고 싶은 것도 편하게 골라주세요.", "공통", "두 축을 동시에 안내"],
  ["대화 첫 질문", "어떤 이야기든 좋아요. 어떤 점이 궁금하세요?", "공통", "자유 발화 유도"],
  ["대화 첫 질문", "필요한 복지든 즐길 거리든, 어떤 걸 찾아드릴까요?", "공통", "필요와 욕구 축 명시"],
], [130, 460, 190, 360]);

addSheet("대화_트리", [
  ["노드", "질문", "선택지", "축", "검색/다음 동작"],
  ["root", "무엇을 도와드릴까요? 필요한 것도, 해보고 싶은 것도 편하게 골라주세요.", "끼니·생활이 힘들어요 / 외롭고 말벗이 없어요 / 몸이 아프고 건강이 걱정돼요 / 돈·생활비가 걱정돼요 / 즐길 거리·모임을 찾고 싶어요 / 새로운 걸 배우고 싶어요 / 긴급하게 도움이 필요해요", "공통", "각 세부 노드로 이동"],
  ["care_life", "식사나 집안일은 어떻게 지내세요?", "끼니를 거를 때가 많아요 / 장보기·요리가 힘들어요 / 청소·집안일이 버거워요", "필요(생활형)", "급식·식사·도시락·가사·돌봄 토큰 검색"],
  ["care_lonely", "혼자 계시는 시간은 어떤가요?", "거의 늘 혼자예요 / 가끔 외롭고 말벗이 필요해요 / 사람들과 어울리고 싶어요", "필요+욕구", "돌봄 또는 문화·모임으로 분기"],
  ["health_1", "어떤 점이 가장 불편하세요?", "병원 가기가 힘들어요 / 약값·치료비가 부담돼요 / 기억력·치매가 걱정돼요 / 정기 건강검진을 받고 싶어요", "필요(생활형)", "건강·의료·검진 토큰 검색"],
  ["money_1", "돈과 관련해 어떤 도움이 필요하세요?", "매달 생활비가 부족해요 / 일자리를 찾고 싶어요 / 갑자기 큰돈이 필요해요", "필요(생활형)", "생계·연금·일자리·긴급복지 검색"],
  ["culture_1", "어떤 활동을 찾고 계세요?", "경로당·모임에 나가고 싶어요 / 취미·여가 프로그램을 배우고 싶어요 / 나들이·문화 행사에 가보고 싶어요", "욕구(여가·문화·배움)", "문화·여가·모임·나들이·공연 토큰 검색"],
  ["learn_1", "무엇을 배우고 싶으세요?", "스마트폰을 잘 쓰고 싶어요 / 키오스크·은행 쓰기가 어려워요 / 글·컴퓨터를 배우고 싶어요", "욕구(여가·문화·배움)", "디지털·교육·문해·컴퓨터 검색"],
  ["emergency_1", "지금 위급한 상황이신가요? 위험하시면 먼저 119에 전화해 주세요.", "지금 많이 위험해요 / 평소를 위해 준비하고 싶어요", "필요(생활형)", "119 우선 안내 및 응급·안전 자원 검색"],
], [130, 310, 520, 190, 340]);

addSheet("데이터_AI", [
  ["구분", "현재 구현", "확장 계획", "보고서 의미"],
  ["앱용 DB", "418건 JSON: 정부24, 복지로, 광진구 민간복지, 서울 노인복지 TOP10", "chunk 단위 RAG context 분리", "근거 기반 추천 산출물"],
  ["추천 로직", "키워드·카테고리·출처·우선순위 기반 검색", "임베딩 검색과 LLM 설명문 결합", "환각을 줄이기 위해 DB 검색 결과를 우선"],
  ["음성", "브라우저 Web Speech API와 speechSynthesis", "NAVER Cloud CLOVA Speech/Voice 서버리스 연동", "고령층 접근성 강화"],
  ["내부 평가", "admin.html 15문항 예비 평가", "ROUGE, METEOR, BERTScore, Faithfulness, 환각 체크", "지도교수 피드백 반영"],
  ["배포", "정적 웹앱 구조", "GitHub push 후 Vercel 자동 배포", "실제 접속 가능한 개발물"],
], [140, 360, 360, 360]);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
});
if (errors.ndjson && errors.ndjson.includes("#")) {
  console.log(errors.ndjson);
}

await fs.mkdir(new URL("../docs/", import.meta.url), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(String(outputPath.pathname));
