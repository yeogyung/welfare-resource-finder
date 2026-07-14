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

현재 1차 범위는 사용자, 참가자, 대화 기록, 사용량 기록 테이블이다.

저장되는 정보:

- 서버 생성 사용자 ID
- 이름 표시값
- 전화번호 마스킹 값
- 전화번호 뒤 4자리
- 전화번호/이름 조합 해시
- 이용 주체: `general`, `participant`, `staff`
- 사용자 타입: `guest`, `participant_pending`, `staff`

저장하지 않는 정보:

- 전화번호 원문

## 참가자 명단 임포트

참가자 명단은 개인정보가 포함되므로 GitHub/public에 올리지 않는다.

1. `docs/supabase-schema.sql`을 먼저 실행한다.
2. 로컬에서 생성한 `private/participants-import.sql`을 Supabase SQL Editor에서 실행한다.
3. `Table Editor > participants`에서 참가자 행이 보이는지 확인한다.

`private/` 폴더는 `.gitignore`에 포함되어 있어 커밋되지 않는다.

## 이후 확장

다음 단계에서 추가할 테이블:

| 테이블 | 목적 |
|---|---|
| `education_sessions` | 교육 그룹/회차/날짜 |
| `image_jobs` | 이미지 생성/편집 요청 |
| `resource_clicks` | 자원 카드/전화/공유 클릭 |
