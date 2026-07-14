# Supabase 연결 준비

## 필요한 값

Vercel Project Settings > Environment Variables에 아래 값을 추가한다.

| 환경변수 | 설명 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL 또는 Data API URL. `https://...supabase.co`와 `https://...supabase.co/rest/v1` 둘 다 허용한다. |
| `SUPABASE_SECRET_KEY` | 서버 전용 Secret key. `sb_secret_...` 형태면 이 값을 우선 사용한다. 브라우저 코드에 넣지 않는다. |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy `service_role` key를 쓸 때만 사용한다. 새 프로젝트라면 보통 `SUPABASE_SECRET_KEY`가 우선이다. |
| `APP_SECRET` | 이름+전화번호 해시용 비밀값. 긴 임의 문자열로 설정한다. |

## 1차 테이블

Supabase SQL Editor에서 `docs/supabase-schema.sql` 내용을 실행한다.

현재 1차 범위는 사용자, 참가자, 대화 기록, 사용량/클릭 기록 테이블이다.

저장되는 정보:

- 서버 생성 사용자 ID
- 이름 표시값
- 전화번호 마스킹 값
- 전화번호 뒤 4자리
- 전화번호/이름 조합 해시
- 이용 주체: `general`, `participant`, `staff`
- 사용자 타입: `guest`, `participant_pending`, `staff`
- 대화 원문: 사용자 입력, 찾아봇 답변
- 사용량/이벤트: OpenAI 호출 토큰, 이미지 요청, 주요 버튼/자원 카드 클릭

저장하지 않는 정보:

- 전화번호 원문
- GA4로 원문 질문/답변 전송

## 참가자 명단 임포트

참가자 명단은 개인정보가 포함되므로 GitHub/public에 올리지 않는다.

1. `docs/supabase-schema.sql`을 먼저 실행한다.
2. 로컬에서 생성한 `private/participants-import.sql`을 Supabase SQL Editor에서 실행한다.
3. `Table Editor > participants`에서 참가자 행이 보이는지 확인한다.

`private/` 폴더는 `.gitignore`에 포함되어 있어 커밋되지 않는다.

## 로그 확인과 보존 가이드

Supabase Table Editor에서 아래 테이블을 확인한다.

| 테이블 | 확인 내용 |
|---|---|
| `app_users` | 로그인 사용자, 참가자 매칭 여부 |
| `participants` | 교육 참가자 명단 |
| `conversations` | 대화 묶음 |
| `messages` | 사용자 입력/찾아봇 답변 원문 |
| `usage_events` | OpenAI 사용량과 `event:*` 클릭 로그 |

운영 원칙:

- 원문 대화는 GA4가 아니라 Supabase `messages`에만 저장한다.
- `usage_events.feature`가 `event:resource_detail_click`, `event:saved_share`처럼 시작하면 클릭 로그다.
- 원문 대화에는 건강, 가족, 연락처 같은 개인정보가 섞일 수 있으므로 관리자만 접근한다.
- 교육/실습 종료 후에는 필요한 기간만 보관하고 오래된 `messages`부터 정리한다.
- Supabase Free 플랜에서는 로그가 계속 쌓이면 저장 용량과 조회 속도에 영향을 줄 수 있다.

보존 기간을 정한 뒤에는 아래처럼 기간 기준 삭제 쿼리를 별도로 실행한다.

```sql
delete from public.messages where created_at < now() - interval '90 days';
delete from public.conversations where updated_at < now() - interval '90 days';
delete from public.usage_events where created_at < now() - interval '180 days';
```

## 이후 확장

다음 단계에서 추가할 테이블:

| 테이블 | 목적 |
|---|---|
| `education_sessions` | 교육 그룹/회차/날짜 |
| `image_jobs` | 이미지 생성/편집 요청 |
| `resource_clicks` | 클릭 로그를 `usage_events`와 분리하고 싶을 때 별도 테이블로 확장 |
