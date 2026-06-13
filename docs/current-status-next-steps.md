# 현재 상황 및 다음 작업 계획

## 현재 상황

- 사용자용 찾아봇 앱은 홈/대화/탐색/찜 중심으로 구성되어 있다.
- 최신 프로토타입을 반영해 홈 첫 질문은 랜덤화하고, 빠른 질문과 찜 필터는 `생활 도움`/`활동·여가` 두 축으로 정리했다.
- RAG/검색 평가는 사용자 화면에서 제거하고 내부 `admin.html`로 분리했다.
- 복지자원 DB 418건은 `public/data/welfare-resources.json`에 들어 있다.
- 디자인, DB, 교육자료, 홍보자료, 프로토타입은 도전학기제 개인 산출물로 통합 정리한다.
- 로컬 서버에서는 사용자 앱과 admin 화면이 구동된다.
- GitHub 원격 push는 SSH key 등록 후 가능하다.
- Vercel 배포는 GitHub push 이후 repo import로 진행한다.
- AI/음성 운영 기능은 국내 결제 가능한 네이버클라우드 기반으로 확장한다.

## 다음 개발 순서

1. 사용자가 전달하는 최신 프로토타입 HTML/CSS/이미지 확인
2. IA 기준으로 사용자 화면과 admin 기능 분리
3. `index.html`, `styles.css`, `app.js` 반영
4. `admin.html`, `admin.js`는 RAG/검색 평가 전용으로 유지
5. 로컬 브라우저 검증
6. Git commit
7. GitHub SSH key 등록 후 push
8. Vercel GitHub import 및 자동 배포 확인
9. Colab RAG/성능평가 노트북 정리
10. 네이버클라우드 STT/TTS/LLM 서버리스 API 설계

## 사용자가 준비할 것

- GitHub SSH public key 등록
- Vercel 계정 준비
- 최신 프로토타입 HTML/CSS/이미지 제공
- 네이버클라우드 계정 및 API 사용 가능 여부 확인
- 결과보고서에 넣어도 되는 활동/미팅/멘토링 내역 확인
- 보고서에 넣으면 안 되는 예산/내부 운영 표현 확정

## 평가 계획

교수님 피드백에 따라 다음 평가를 진행한다.

- ROUGE: 정답 예시와 생성 답변의 단어 기반 중복도
- METEOR: 어휘 변형과 의미 유사성을 일부 반영한 단어 기반 평가
- BERTScore: 임베딩 기반 의미 유사도
- Faithfulness: 생성 답변이 검색된 복지자원 context에 충실한지 확인
- 환각 체크: DB에 없는 전화번호, URL, 신청절차, 대상조건을 생성했는지 확인

평가는 사용자 화면이 아니라 Colab, admin 화면, 별도 평가표에서 수행한다.
