# 배포·서버·결제 준비 계획

## 현재 결정사항

- 예산 집행상 국내 결제가 가능한 서비스 중심으로 AI/음성 기능을 설계한다.
- 원화로 표시되더라도 해외 가맹점 결제일 수 있는 서비스는 실증 운영 후보에서 제외하고, 네이버클라우드 중심으로 검토한다.
- 현재 사용자 프로토타입은 정적 웹앱이므로 Vercel/GitHub만으로 먼저 배포 가능하다.
- RAG/AI 평가는 사용자 화면이 아니라 내부 `admin.html`에서 수행한다.
- 네이버클라우드 API 키는 프론트엔드 코드에 직접 넣지 않고 서버리스 API 또는 백엔드 환경변수로 관리한다.

## GitHub와 자동 배포

GitHub와 Vercel을 연동하면 GitHub에 `push`된 커밋은 Vercel에서 자동 배포된다.

단, 로컬 파일이 저장될 때마다 GitHub에 자동 업로드되는 것은 아니다. 로컬 변경은 반드시 아래 흐름을 거쳐야 한다.

```bash
git add .
git commit -m "변경 내용"
git push origin main
```

현재 로컬 repo는 커밋이 쌓여 있지만, GitHub SSH 인증이 해결되지 않아 원격 push가 막힌 상태다.

## 지금 준비해야 할 것

| 우선순위 | 준비 항목 | 이유 | 상태 |
|---|---|---|---|
| P0 | GitHub SSH key 등록 | 로컬 커밋을 GitHub에 push하기 위해 필요 | 필요 |
| P0 | Vercel 계정 및 GitHub repo import | 공개 배포 URL 확보 | 필요 |
| P0 | 배포 후 모바일 실기기 테스트 | 어르신 대상 UI/음성 UX 확인 | 필요 |
| P1 | 네이버클라우드 계정 결제 확인 | 국내 결제 가능성 확보 | 가능 확인됨 |
| P1 | 사용량 한도/예산 알림 설정 | API 과금 통제 | 필요 |
| P1 | CLOVA Speech/Voice 또는 CLOVA Studio 키 발급 | 운영형 음성/AI 기능 연동 | 추후 |
| P2 | 관리자 화면 보호 | `/admin.html` 외부 노출 제한 | API 도입 전 필요 |

## 배포 구조

### 1차 배포: 정적 MVP

| 구성 | 사용 기술 | 결제 필요 여부 |
|---|---|---|
| 사용자 앱 | `index.html`, `styles.css`, `app.js` | 없음 |
| 내부 평가 | `admin.html`, `admin.js` | 없음 |
| DB | `public/data/welfare-resources.json` | 없음 |
| 배포 | Vercel + GitHub | 무료 범위 가능 |

1차 배포에서는 네이버클라우드 결제가 없어도 된다. 브라우저 내장 STT/TTS로 시연 가능하다.

### 2차 확장: 네이버클라우드 API

| API | 후보 상품 | 목적 | 우선순위 |
|---|---|---|---|
| `/api/stt` | NAVER Cloud CLOVA Speech 또는 CSR | 어르신 음성을 텍스트로 변환 | P1 |
| `/api/tts` | NAVER Cloud CLOVA Voice | 추천 결과를 자연스러운 음성으로 안내 | P1 |
| `/api/recommend` | CLOVA Studio + DB 검색 | DB 기반 추천 결과를 자연스럽게 설명 | P1 |
| `/api/evaluate` | 내부 평가 로직 | RAG/검색 품질 평가 자동화 | P2 |
| `/api/admin-auth` | 서버리스 인증 | 관리자 화면 보호 | P2 |

## 결제 우선순위

| 우선 | 결제 요소 | 왜 필요한지 | 지금 판단 |
|---|---|---|---|
| 1 | CLOVA Speech/CSR | 음성 입력 실증 설득력 확보 | 네이버클라우드 결제 가능 시 우선 |
| 2 | CLOVA Voice | 어르신에게 추천 결과를 음성으로 읽기 | STT 다음 |
| 3 | CLOVA Studio | 추천 카드 설명문/요약문 생성 | DB 검색 안정화 후 |
| 4 | Cloud Functions/Serverless | API 키 보호, STT/TTS/RAG 호출 | API 도입 시 필수 |
| 5 | 저장소/DB | 로그, 평가 결과, 녹음 파일 임시 저장 | 개인정보 정책 정리 후 |

## 쓰지 않는 것이 좋은 것

- 해외 AI API 직접 결제: 예산 집행상 국내 결제 가능 서비스 중심으로 운영하기 위해 제외
- 프론트엔드에 API 키 직접 삽입: 보안상 금지
- 사용자 앱에 RAG 점수 노출: 사용자 경험과 무관하며 혼란 유발
- 초기에 복잡한 회원가입/개인정보 저장: 실증·동의·보안 부담 증가

## 보고서용 표현

> 예산 집행 가능성과 운영 안정성을 고려하여 해외 AI API 직접 결제 방식은 제외하고, 국내 결제가 가능한 네이버클라우드 기반 STT/TTS/LLM 연동 구조를 설계하였다. 1차 배포는 Vercel과 GitHub를 활용한 정적 웹 MVP로 진행하고, 2차 실증 단계에서 NAVER Cloud CLOVA Speech/Voice 및 CLOVA Studio를 서버리스 API로 연동하는 방식으로 확장 계획을 수립하였다.

## 현재 파일 기준

- 사용자 앱: `index.html`
- 내부 평가: `admin.html`
- 앱 기준 DB: `public/data/welfare-resources.json`
- DB 정리본: `docs/db-resource-design.md`
- 음성 설계: `docs/voice-architecture.md`
- IA 갱신본: `docs/찾아봇_IA_갱신본_2026-06-14.xlsx`
