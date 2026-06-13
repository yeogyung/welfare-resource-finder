# 찾아봇 AI MVP

서울청년기획봉사단 3기 `찾아봄` 활동에서 기획한 어르신 복지자원 대화형 탐색 서비스입니다. 이 저장소는 도전학기제 결과보고서 제출을 위한 개발 산출물로, IA/와이어프레임/Figma 디자인을 바탕으로 구현한 배포 가능 MVP입니다.

기존 RAG Colab 노트북은 저장소에 함께 보존하고, 본 웹앱은 해당 RAG/DB 실험을 실제 사용 가능한 모바일 화면으로 옮긴 산출물입니다.

## 핵심 기능

- 찾아봇 캐릭터가 먼저 안부를 묻는 대화형 홈
- 음성 질문 입력 STT: 브라우저 Web Speech API
- 음성 안내 TTS: 브라우저 `speechSynthesis`
- 정부24, 복지로, 광진구 민간복지, 찾아봄 TOP10 통합 DB 418건 기반 추천
- 응급·안전 질문 우선순위 처리
- 근거 자원 카드: 대상, 지역, 신청방법, 출처, URL 표시
- 찜 저장: `localStorage`
- 사용자 화면과 분리된 내부 RAG/검색 평가 관리자 화면

## 저장소 구성

- `index.html`, `styles.css`, `app.js`: 사용자용 모바일 웹앱
- `admin.html`, `admin.js`: 내부 RAG/검색 평가 화면
- `public/assets/`: 찾아봇 로고 및 캐릭터 상태 이미지
- `public/data/`: 통합 복지자원 JSON
- `docs/`: IA, RAG 평가, 음성 대화 설계
- `scripts/build_resources.py`: 팀 DB 엑셀을 앱 JSON으로 변환한 스크립트
- `*.ipynb`: RAG/LLM 프로토타입 Colab 노트북

## 데이터 출처

앱 데이터는 팀이 정리한 엑셀 파일을 `scripts/build_resources.py`로 통합 변환했습니다.

- 정부24 복지서비스 라벨링
- 복지로 API 수집 정리본
- 광진구 민간복지자원 라벨링 60개
- 찾아봄 서울 노인복지 TOP10

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

## 배포

Vercel에서 이 폴더를 프로젝트 루트로 연결하면 바로 배포할 수 있습니다.

```bash
git remote add origin https://github.com/yeogyung/welfare-resource-finder.git
git push -u origin main
```

## 문서

- [IA 및 구현 범위](docs/ia.md)
- [RAG 평가 설계](docs/rag-evaluation.md)
- [음성 대화 설계](docs/voice-architecture.md)
- [선제 안부 대화 설계](docs/proactive-care-plan.md)
- [DB 정리본](docs/db-resource-design.md)

## 보고서용 요약

본 MVP는 복지자원 DB 기반 대화형 추천, 음성 입출력, 근거 URL 표시, 찜 저장 기능을 포함한다. 사용자용 프로토타입은 어르신 경험에 집중하도록 구성하고, RAG/검색 품질 평가는 별도 내부 관리자 화면으로 분리했다. 단순 화면 시안이 아니라 실제 브라우저에서 구동되는 정적 웹앱으로 구현했으며, 향후 NAVER Cloud CLOVA Speech/Voice와 연동하여 현장 실증용 음성 대화 서비스로 확장할 수 있다.
