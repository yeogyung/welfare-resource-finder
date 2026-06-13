# 찾아봇 AI MVP

서울청년기획봉사단 3기 활동과 도전학기제 수행 과정에서 기획한 어르신 복지자원 대화형 탐색 서비스입니다. 이 저장소는 도전학기제 결과보고서 제출을 위한 개발 산출물로, IA/와이어프레임/Figma 디자인을 바탕으로 구현한 배포 가능 MVP입니다.

기존 RAG Colab 노트북은 저장소에 함께 보존하고, 본 웹앱은 해당 RAG/DB 실험을 실제 사용 가능한 모바일 화면으로 옮긴 산출물입니다.

## 핵심 기능

- 새로고침마다 달라지는 상황 발견형 첫 질문
- 필요(생활형)과 욕구(여가·문화·배움) 두 축의 빠른 질문
- 입력창 예시 문구와 대화 첫 질문 랜덤화
- 음성 질문 입력 STT: 브라우저 Web Speech API
- 음성 안내 TTS: 브라우저 `speechSynthesis`
- 정부24, 복지로, 광진구 민간복지, 서울 노인복지 TOP10 통합 DB 418건 기반 추천
- 내장 RAG 추천 엔진: 생활형/여가·문화·배움/긴급 축 판별, 자원 점수화, 추천 근거 생성
- 응급·안전 질문 우선순위 처리
- 근거 자원 카드: 대상, 지역, 신청방법, 출처, URL 표시
- 찜 저장 및 보호자·활동가 공유: `localStorage`
- 설정: 큰 글자, 음성 안내, 지역 설정
- 사용자 화면과 분리된 내부 RAG/검색 평가 관리자 화면

## 저장소 구성

- `index.html`, `styles.css`, `app.js`: 사용자용 모바일 웹앱
- `admin.html`, `admin.js`: 내부 RAG/검색 평가 화면
- `public/js/chajabot-engine.js`: 사용자 앱, 관리자 평가, API가 공유하는 내장 RAG 추천 엔진
- `api/recommend.js`: Vercel 배포 후 사용할 추천 API 엔드포인트
- `public/assets/`: 찾아봇 로고 및 캐릭터 상태 이미지
- `public/data/`: 통합 복지자원 JSON
- `docs/`: IA, RAG 평가, 음성 대화 설계
- `scripts/build_resources.py`: 수집·정리한 DB 엑셀을 앱 JSON으로 변환한 스크립트
- `*.ipynb`: RAG/LLM 프로토타입 Colab 노트북

## 데이터 출처

앱 데이터는 수집·라벨링한 엑셀 파일을 `scripts/build_resources.py`로 통합 변환했습니다.

- 정부24 복지서비스 라벨링
- 복지로 API 수집 정리본
- 광진구 민간복지자원 라벨링 60개
- 서울 노인복지 TOP10

생성 결과:

- `public/data/welfare-resources.json`
- `public/data/resource-stats.json`

원본 엑셀을 다시 반영할 때는 아래 순서로 재생성합니다.

```bash
python3 -m pip install -r requirements.txt
python3 scripts/build_resources.py
```

## 로컬 실행

정적 웹앱이므로 별도 빌드 없이 실행합니다.

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173` 접속.

추천 API는 Vercel 배포 후 아래 형태로 확인할 수 있습니다.

```bash
curl "https://배포주소/api/recommend?q=스마트폰%20배우고%20싶어요&limit=3"
```

## 배포

Vercel에서 이 폴더를 프로젝트 루트로 연결하면 바로 배포할 수 있습니다.

```bash
git push -u origin main
```

로컬 파일이 GitHub에 자동 업로드되지는 않습니다. `git add`, `git commit`, `git push` 이후 GitHub와 연결된 Vercel 프로젝트에서 자동 배포됩니다.

## 문서

- [IA 및 구현 범위](docs/ia.md)
- [RAG 평가 설계](docs/rag-evaluation.md)
- [음성 대화 설계](docs/voice-architecture.md)
- [상황 발견형 질문 UX 설계](docs/proactive-care-plan.md)
- [DB 정리본](docs/db-resource-design.md)
- [배포·서버·결제 준비 계획](docs/deployment-server-payment-plan.md)
- [현재 상황 및 다음 작업 계획](docs/current-status-next-steps.md)

## 보고서용 요약

본 MVP는 복지자원 DB 기반 대화형 추천, 상황 발견형 랜덤 질문, 필요(생활형)/욕구(여가·문화·배움) 축 분류, 음성 입출력, 근거 URL 표시, 찜 저장 및 공유 기능을 포함한다. 사용자용 프로토타입은 어르신 경험에 집중하도록 구성하고, RAG/검색 품질 평가는 별도 내부 관리자 화면으로 분리했다. 단순 화면 시안이 아니라 실제 브라우저에서 구동되는 정적 웹앱으로 구현했으며, 향후 NAVER Cloud CLOVA Speech/Voice와 연동하여 현장 실증용 음성 대화 서비스로 확장할 수 있다.
