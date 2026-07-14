# 찾아봇 Vercel 배포 최신화 안내

작성일: 2026-07-06

## 지금 파일 구성

- `index.html`: 사용자용 찾아봇 화면
- `app.js`: 추천/대화/찜/음성 동작
- `styles.css`: 공통 스타일
- `api/`: Vercel Serverless Function
- `public/`: 이미지와 복지자원 DB
- `public/manifest.webmanifest`: PWA 설치 정보
- `service-worker.js`: 홈 화면 설치 앱의 오프라인/캐시 처리
- `vercel.json`: Vercel 배포 설정
- `dist/`: Vercel이 실제로 배포할 정적 결과물

`vercel.json` 기준 설정은 아래와 같습니다.

- Framework Preset: Other 또는 None
- Build Command: `npm run build`
- Output Directory: `dist`

## GitHub에 연결되어 있는 경우

1. 최신 파일을 GitHub 저장소에 반영합니다.
2. `main` 브랜치에 commit/push합니다.
3. Vercel이 자동으로 새 배포를 만듭니다.
4. Vercel 대시보드의 Deployments에서 최신 배포가 Production인지 확인합니다.

Vercel은 Git 저장소가 연결되어 있으면 commit 또는 pull request마다 새 배포를 만들고, production branch에 반영된 변경을 Production 배포로 올립니다.

## zip으로 직접 갱신해야 하는 경우

1. `chajabot-vercel-latest.zip` 압축을 풉니다.
2. Vercel에서 기존 프로젝트를 유지하려면 같은 GitHub 저장소에 파일을 덮어씌운 뒤 push합니다.
3. GitHub를 쓰지 않을 경우 Vercel CLI 또는 Vercel 대시보드의 새 프로젝트 import/upload 방식으로 올립니다.
4. 배포 설정은 반드시 `npm run build` / `dist`로 맞춥니다.

## 환경변수

AI 답변과 CLOVA 음성 API까지 실제 운영하려면 Vercel Project Settings > Environment Variables에 아래 값을 넣습니다.

필수:

- `NCP_CLOVA_STUDIO_API_KEY`

선택:

- `NCP_CLOVA_STUDIO_ENDPOINT`
- `NCP_CLOVA_STUDIO_MODEL`
- `NCP_CLOVA_VOICE_KEY_ID`
- `NCP_CLOVA_VOICE_KEY`
- `NCP_CLOVA_VOICE_ENDPOINT`
- `NCP_CLOVA_VOICE_SPEAKER`
- `GA4_MEASUREMENT_ID`
- `ADMIN_TOKEN`

환경변수가 없어도 기본 DB 추천 화면은 동작합니다. 다만 `/api/answer`, `/api/tts`의 외부 AI/음성 기능은 제한됩니다.

## 배포 후 확인

1. 홈 화면에서 추천 카드 6개가 보이는지 확인합니다.
2. 직접 입력으로 “병원 가기가 힘들어요”처럼 입력해 추천 결과가 나오는지 확인합니다.
3. 찜 탭과 설정 탭 아이콘이 깨지지 않는지 확인합니다.
4. 설정 > 홈 화면 설치 버튼이 보이는지 확인합니다.
5. `/public/manifest.webmanifest`와 `/service-worker.js`가 열리는지 확인합니다.
6. 음성 버튼은 브라우저 권한 또는 CLOVA 환경변수 설정 상태에 따라 동작이 달라질 수 있습니다.

## 참고 링크

- Vercel Git 배포: https://vercel.com/docs/git
- Vercel 배포 개요: https://vercel.com/docs/deployments
- Vercel 환경변수: https://vercel.com/docs/environment-variables
- Vercel 빌드 설정: https://vercel.com/docs/builds
