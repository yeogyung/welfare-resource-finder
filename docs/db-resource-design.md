# 찾아봇 DB 정리본

## 결론

개발물에 넣어야 하는 기준 DB는 `public/data/welfare-resources.json`이다. 이 파일은 수집·라벨링한 원본 엑셀 4종을 `scripts/build_resources.py`로 통합 변환한 앱용 데이터다.

RAG 테스트용 질문/정답셋은 사용자 DB와 섞지 않고 `admin.js` 내부 평가셋 및 향후 별도 평가 파일로 관리한다.

## DB 구분

| 구분 | 위치 | 용도 | 사용자 노출 |
|---|---|---|---|
| 원본 DB | 배경지식/00_원본자료/다운로드_첨부자료 | 수집·라벨링한 엑셀 원본 | 노출 안 함 |
| 앱용 DB | public/data/welfare-resources.json | 사용자 질문에 대한 복지자원 추천 | 카드 형태로 일부 노출 |
| 통계 DB | public/data/resource-stats.json | 홈 화면 DB 출처/자원 수 표시 | 일부 노출 |
| 평가셋 | admin.js / 향후 eval-dataset.json | RAG/검색 품질 테스트 | 사용자 노출 안 함 |
| 평가 결과 | 관리자 화면 JSON 다운로드 | 보고서/실험 기록 | 사용자 노출 안 함 |

## 현재 통합 규모

| 출처 | 건수 |
|---|---:|
| 정부24 | 238 |
| 복지로 | 110 |
| 광진구 민간복지 | 60 |
| 찾아봄 TOP10 | 10 |
| 합계 | 418 |

## 앱용 DB 필드

| 필드 | 설명 | 사용자 카드 노출 |
|---|---|---|
| id | 앱 내부 자원 ID | 아니오 |
| name | 서비스명 | 예 |
| source | 내부 출처 코드 | 아니오 |
| sourceLabel | 사용자에게 보일 출처명 | 예 |
| priority | 추천 정렬 가중치 | 아니오 |
| category | 내부 분류 코드 | 아니오 |
| categoryLabel | 사용자에게 보일 분류명 | 예 |
| categoryRaw | 원본 대분류/유형 | 필요 시 |
| situation | 상황 키워드 | 간접 노출 |
| target | 지원 대상 | 예 |
| description | 지원 내용 | 예 |
| method | 신청 방법 | 예 |
| period | 신청 기간 | 예 |
| region | 지역 | 예 |
| organization | 운영 기관 | 필요 시 |
| contact | 문의처 | 예 |
| url | 공식 상세 링크 | 예 |
| requiresCheck | 추가 검수 필요 여부 | 필요 시 |
| searchText | 검색용 통합 텍스트 | 아니오 |

## 사용자 IA 축 매핑

앱 화면에서는 세부 카테고리 전체를 그대로 노출하기보다, 어르신이 이해하기 쉬운 두 축으로 먼저 묶는다.

| IA 축 | 연결 카테고리 | 화면 반영 |
|---|---|---|
| 필요(생활형) | 응급·안전, 돌봄·생활, 건강·의료, 경제·일자리, 주거 | 홈 빠른 질문, 추천 카드 메타, 찜/공유 |
| 욕구(여가·문화·배움) | 디지털·배움, 문화·여가 | 홈 빠른 질문, 여가·문화 분기, 추천 카드 메타, 찜/공유 |

이 축은 DB의 원본 분류를 대체하지 않고, 사용자에게 보이는 첫 탐색 구조로만 사용한다. 실제 검색과 평가는 세부 카테고리, 키워드, 출처, 우선순위를 함께 사용한다.

## RAG 개발 시 필요한 추가 DB

운영 버전에서 LLM/RAG를 붙이려면 앱용 DB 외에 다음 테이블이 추가로 필요하다.

| 테이블 | 목적 | 주요 필드 |
|---|---|---|
| resource_chunks | 검색/RAG context 단위 | resource_id, chunk_id, text, source_url, updated_at |
| eval_questions | 평가 질문셋 | question, expected_category, expected_keywords, expected_resource_ids |
| generated_answers | 모델 응답 로그 | question_id, model, answer, retrieved_ids, created_at |
| eval_scores | 평가 결과 | answer_id, rouge, meteor, bertscore, faithfulness, hallucination_flags |
| review_notes | 사람이 검수한 내용 | resource_id, issue_type, note, reviewer, status |

## IA 반영 원칙

- 사용자 앱 IA에는 RAG 평가/모델 점수를 넣지 않는다.
- 사용자 앱은 랜덤 첫 질문, 랜덤 입력 예시, 필요(생활형)/욕구(여가·문화·배움) 축, 추천, 찜, 공유, 음성 안내에 집중한다.
- 내부 관리자 IA에서만 DB 상태, 평가셋, 모델 응답 품질, 환각 여부를 확인한다.
- 보고서에는 두 산출물을 분리해 서술한다.
  - 사용자 프로토타입: 어르신 복지자원 탐색 경험
  - 내부 평가 도구: 알고리즘/RAG 품질 검증
