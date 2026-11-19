# SonTube

SonTube는 부모가 PC·모바일 웹에서 안전 영상을 관리하고, 아이는 주소창 없는 제한형 Android 앱에서 승인 영상만 고르는 가족용 영상서랍 MVP입니다.

## 공개 화면과 보호 화면

- `/`: 부모가 서비스 목적과 사용 흐름을 확인하는 공개 소개 화면
- `/lite`: 운영자가 명시적으로 Lite 공개한 안전 승인 영상만 사용하는 읽기 전용 공용 체험
- `/admin`: 활성 보호자가 자기 가족의 영상만 관리하는 화면 (계정은 최종관리자가 생성)
- `/superadmin`: 별도 `SUPERADMIN_*` 자격 증명을 가진 소유자 한 명의 운영 화면
- `/app`: 앱 키·설치 ID와 가족 정책을 사용하는 Android 제한형 클라이언트 화면
- `/api/health`: DB 읽기 가능 여부만 200/503으로 반환하는 no-store 운영 헬스체크

Lite는 제목·보호자 키워드 검색, 태그·채널 필터, 같은 채널의 공개 영상 보기, YouTube iframe 재생·전체 화면과 브라우저 로컬 내 목록만 제공합니다. 앱 키, 결제, 가족별 데이터, 서버 피드백, Android 기기 잠금과 Wi-Fi 강제 기능은 제공하지 않습니다. 제한형 시청과 가족별 승인 목록은 Android 앱의 책임이며, 초기 Lite는 `noindex`로 운영합니다.

## 실행 방법

Node.js 22.5 이상을 사용합니다. 현재 웹·운영 도구 검증 기준은 Node.js 22.17.0입니다.

1. `C:\codex\app\sontube` 폴더에서 의존성을 설치합니다.

```bash
npm install
```

2. 환경 파일을 만듭니다.

```bash
copy .env.example .env
```

3. 보호자와 최종관리자 비밀번호 해시를 각각 만들고 관리자 이메일 allowlist를 설정합니다.

PowerShell에서 `C:\codex\app\sontube` 경로로 이동합니다. 두 계정은 서로 다른 비밀번호와 세션 비밀키를 사용하세요.

```bash
npm run auth:hash -- <parent-password> <SESSION_SECRET>
npm run auth:hash -- <superadmin-password> <SUPERADMIN_SESSION_SECRET>
```

첫 해시는 `.env`의 `ADMIN_PASSWORD_HASH`, 두 번째 해시는 `SUPERADMIN_PASSWORD_HASH`에 넣습니다. 보호자 이메일은 `PARENT_BOOTSTRAP_EMAIL`, 최종관리자 ID는 `SUPERADMIN_LOGIN_ID`로 설정합니다.

`.env`의 `ADMIN_ALLOWED_EMAILS`는 선택 설정으로, 공용 Lite 공개를 허용할 운영자 두 이메일만 지정합니다. 비워두면 Lite 공개를 변경할 수 없지만 활성 보호자 로그인은 가능합니다. 일반 가족·보호자는 브라우저에서 `최종관리자 로그인 > 사용자·가족`(`/superadmin/users`)으로 이동해 생성합니다. 실제 이메일이나 비밀번호는 저장소·문서·채팅에 기록하지 않습니다.

4. SQLite DB와 Prisma Client를 준비합니다.

```bash
npm run db:generate
npx prisma migrate deploy
npm run db:seed
```
5. 개발 서버를 실행합니다.

```bash
npm run dev
```

Android 실제 기기에서 같은 Wi-Fi의 PC 서버에 접속해 시험할 때는 아래 명령을 사용합니다.

```bash
npm run dev:lan
```

이 경우 Windows 방화벽과 `android-client/gradle.properties`의 `SONTUBE_DEBUG_APP_URL`을 함께 확인합니다. 배포용 릴리스는 별도의 `SONTUBE_RELEASE_APP_URL` HTTPS 주소가 없으면 빌드되지 않습니다.

6. 브라우저에서 접근합니다.

- 부모용 공개 소개: `http://127.0.0.1:3000/`
- 공개 Lite 체험: `http://127.0.0.1:3000/lite`
- 관리자: `http://127.0.0.1:3000/admin`
- 관리자 로그인: `http://127.0.0.1:3000/admin/login`
- 영상 등록: `http://127.0.0.1:3000/admin/videos/new`
- 채널 목록: `http://127.0.0.1:3000/admin/channels`
- 태그 관리: `http://127.0.0.1:3000/admin/tags`
- 관심 요약: `http://127.0.0.1:3000/admin/insights`
- 이용권·결제: `http://127.0.0.1:3000/admin/payment`
- 최종관리자: `http://127.0.0.1:3000/superadmin/login`
- Android 앱에 표시되는 콘텐츠 화면: `http://127.0.0.1:3000/app`
- 보호자 로그인 후 사용하는 브라우저 QA용 아이 화면: `http://127.0.0.1:3000/kids`

## 구현된 기능

- 관리자 영상 등록, 수정, 목록
- 관리자 이메일 allowlist와 활성 보호자 계정을 함께 확인하는 이중 관리자 로그인 제한
- 운영자가 별도로 Lite 공개한 안전 승인 영상만 반환하는 공개 카탈로그 API
- 가족 ID·원본 URL·앱 키·결제 데이터를 제외한 Lite 카탈로그, ETag와 최대 60초 CDN 캐시
- 관리자 영상 목록의 검색, 채널, 태그, 상태, 부모 추천, 썸네일 필터
- 가족별 채널 마스터와 영상의 선택적 `channelId` 연결
- 영상 등록·수정 시 기존 채널 선택 또는 보호자가 새 채널명 직접 입력
- 채널 관리 화면의 이름 변경, 신규 선택 비활성화, 중복 채널 병합과 채널별 영상 바로가기
- 가족별 보호자 이메일 로그인과 서버 액션 보호
- Family 기준 영상·태그·앱 키·아이 반응 데이터 격리
- 무료 가족 한도 안내와 과거 결제·환불 내역 보존 (신규 결제 차단)
- 최종관리자 전용 로그인, 사용자·상품·입금·환불·감사 로그 관리
- 멱등 입금 승인, 이용권 생성·연장과 전액 환불 회수
- 사유·재인증·30분 제한이 있는 보호자 대체 로그인
- 로그인 화면의 초기 설정/비밀번호 재설정 안내
- 관리자 메뉴별 첫 방문 슬라이드 가이드와 키보드 포커스 제어
- YouTube URL에서 `videoId` 파싱
- YouTube 채널, 플레이리스트, 검색 URL 거부
- 중복 `videoId` 등록 방지
- 보호자 수동 입력 제목, 설명, 영상 시간 저장
- 안전 검토 상태와 공개 여부 관리
- 태그 생성, 수정, 활성/비활성, 사용 횟수 관리
- 최근 사용, 자주 사용, 제목/설명 키워드, 유사 영상 기반 추천 태그
- YouTube 기본 썸네일, 커스텀 썸네일 업로드, placeholder fallback
- 커스텀 썸네일 교체/해제 시 앱 관리 업로드 파일 정리
- 아이 화면의 승인/공개 영상만 표시
- 앱 카탈로그에 선택적 채널 정보를 포함하고 같은 채널의 승인·공개 영상만 로컬 필터링
- 외부 YouTube 채널 이동이나 채널 영상 자동 수집 없이 `같은 채널의 승인 영상 N개` 동작 제공
- 아이 화면 내부 제목/보호자 키워드 검색, 태그 필터, 핫태그 표시
- 보호자가 적은 검색 키워드 기반 아이 화면 검색
- 보호자가 체크한 부모님 최근 추천 섹션
- 아이 브라우저 안에서 쓰는 간단한 내 목록 플레이리스트
- 아이 영상 화면의 간단 피드백 버튼: 좋아요, 다시 볼래요, 궁금해요, 웃겨요, 어려워요, 별로예요
- 아이의 내 목록 담기와 피드백 신호 저장
- 부모가 확인하는 아이 관심 요약 화면
- 관심 요약의 최근 7일, 최근 30일, 전체 기간 필터
- 관심 영상, 내 목록 영상, 키워드, 태그 기반 요약
- 외부 AI 도구에 붙여넣을 수 있는 통계 기반 프롬프트 생성
- 등록된 영상만 YouTube iframe으로 재생
- PWA manifest 기본 설정
- 기간 제한 없는 무료 앱 키, 설치 ID 바인딩, 가족 변경 번호 기반 승인 카탈로그 JSON 동기화
- Android WebView 설치형 클라이언트와 정확한 `/app` 최상위 경로 제한
- 외부 URL, 관리자 화면, 새 창, 다운로드, 파일 접근 차단
- WebView 탐색 기록 미복원, 뒤로가기 목적지와 History API 주소 재검사
- 앱 표시 중 네트워크 변경 즉시 차단, 통신 정책 재확인과 fail-closed 샘플 복구
- 앱 키·설치 ID의 cloud backup·기기 이전 차단과 기본 Android 런처 아이콘
- 중요 로그인·동기화·결제 요청의 상한형 프로세스 로컬 rate limit
- 웹 보안 응답 헤더와 빈 DB migration까지 포함한 통합 검증 스크립트·GitHub Actions
- Lite 공개 API를 제외한 관리자·아이·보호 API 응답의 검색 색인 차단과 private no-store 처리
- Lite 성공 응답 JSON Schema·200/304/503 캐시 계약 자동 검증과 weak ETag 재검증
- 보호자 세션 버전 폐기와 읽기 전용 최종관리자 대체 로그인
- Gradle Wrapper와 릴리스 HTTPS 주소 빌드 검증

## 미구현/후순위 기능

- 서비스 워커 기반 설치 경험 고도화
- 시청 시간 제한
- 가족별 프로필 분리
- 아이별 개별 프로필과 다중 아이 통계
- AI API 직접 연동 분석
- 태그 추천 규칙 편집 UI
- 커스텀 썸네일 삭제/교체 이력 관리
- Android 모바일 실기기 재생/전체 화면/외부 이동 차단 테스트
- 스크린리더 기반 접근성 세부 점검
- 화면 고정 또는 관리형 기기 Lock Task 운영 결정

## 테스트 방법

핵심 로직 테스트:

```bash
npm test
```

웹 전체 자동 검증은 프로젝트 루트 `C:\codex\app\sontube`에서 실행합니다. 임시 SQLite DB에 migration을 적용하고 타입, 린트, 테스트와 프로덕션 빌드를 순서대로 확인한 뒤 임시 DB를 삭제합니다.

```bash
npm run verify:web
```

Android의 URL·로딩·시작 정책과 실행 중 네트워크 전환 로직은 같은 프로젝트 루트에서 JDK 17로 검증합니다.

```bash
npm run verify:android:logic
```

빌드 검증:

```bash
npm run build
```

웹 검증은 `.github\workflows\web-ci.yml`, Android 정책 검증은 `.github\workflows\android-logic-ci.yml`에서 push와 pull request마다 각각 실행됩니다. Android debug APK는 `.github\workflows\android-debug-apk.yml`에서 Android 파일 변경 시 별도로 lint·빌드되며, 웹을 배포하거나 스토어용 릴리스를 만들지는 않습니다.

GitHub에서 debug APK를 수동 생성할 때는 `SonTube 저장소 > Actions > Android Debug APK > Run workflow`로 이동합니다. 완료된 실행의 `Artifacts > sontube-android-debug-only-<commit SHA>`에서 APK를 내려받습니다. artifact는 Android 기본 debug signing만 사용하며 14일 뒤 만료됩니다.

수동 확인 경로:

- `관리자 > 영상 등록`: YouTube 영상 URL을 입력하고 `videoId`가 표시되는지 확인
- `공개 화면 > Lite 체험`: 명시적으로 Lite 공개한 영상만 나타나고 공개 영상이 0개일 때 샘플 대신 빈 상태가 나타나는지 확인
- `공개 화면 > Lite 체험`: 검색·태그·채널 필터, 같은 채널 더보기, 재생·전체 화면과 로컬 내 목록이 동작하는지 확인
- `공개 화면 > Lite 체험`: 앱 키·결제·서버 피드백·가족 데이터·Wi-Fi 정책 UI가 없는지 확인
- `관리자 > 로그인`: `.env`에 설정한 비밀번호로 로그인되는지 확인
- `관리자 > 로그인`: allowlist에 없는 활성 `ParentUser`도 로그인할 수 없고, 등록된 두 이메일은 각자 로그인되는지 확인
- `관리자 > 영상 등록`: 채널 URL, 플레이리스트 URL, 검색 URL이 거부되는지 확인
- `관리자 > 영상 등록/수정`: 기존 채널을 선택하거나 새 채널명을 직접 입력할 수 있는지 확인
- `관리자 > 채널`: 채널 이름 변경, 신규 선택 비활성화, 중복 채널 병합과 채널별 영상 바로가기가 동작하는지 확인
- `관리자 > 영상 등록`: 아이 검색 키워드와 부모님 최근 추천 체크가 저장되는지 확인
- `관리자 > 영상 목록`: 검색, 채널, 태그, 상태, 부모 추천, 썸네일 필터가 동작하는지 확인
- `관리자 > 태그 관리`: 태그 생성/수정 후 영상 등록 폼에 표시되는지 확인
- `아이 화면`: 보호자 확인 완료와 공개 상태인 영상만 보이는지 확인
- `아이 화면`: 채널명이 있는 영상의 `같은 채널의 승인 영상 N개`를 누르면 외부 이동 없이 승인·공개 영상만 표시하는지 확인
- `아이 화면`: 제목 또는 보호자 키워드로만 검색되는지 확인
- `아이 화면`: 내 목록 버튼으로 브라우저 로컬 플레이리스트에 담기는지 확인
- `아이 화면 > 영상`: iframe 재생 화면에 관리자 버튼이 없는지 확인
- `아이 화면 > 영상`: 피드백 버튼을 누른 뒤 `관리자 > 관심 요약`에 반영되는지 확인
- `관리자 > 관심 요약`: 최근 7일/30일/전체 필터가 반영되는지 확인
- `관리자 > 관심 요약`: 복사 버튼으로 AI 분석용 프롬프트가 복사되는지 확인
- `관리자 > 영상 수정`: 커스텀 썸네일에서 YouTube 기본 또는 Placeholder로 바꾸면 기존 커스텀 연결이 제거되는지 확인

## 다음 작업 제안

1. 영상 종료 후 동작을 `single_then_close` 설정에 맞게 더 명확히 제어한다.
2. 추천 태그 규칙 편집 UI가 실제로 필요한지 운영하면서 판단한다.
3. 모바일 실기기에서 아이 화면 버튼 크기와 카드 간격을 확인한다.
4. 아이별 프로필은 실제 가족 사용 흐름이 명확해진 뒤 보류 해제한다.
5. AI API 직접 연동은 비용과 개인정보 기준을 정한 뒤 별도 단계로 검토한다.

## 앱 키 동기화 흐름

- 관리자 경로: `http://127.0.0.1:3000/admin/app-keys`
- 앱 경로: `http://127.0.0.1:3000/app`
- 관리자는 앱 키를 만들고, 앱은 설정 화면에서 해당 키를 등록합니다. 새 키는 서버가 정상 승인한 뒤에만 기존 저장 키와 목록을 교체합니다.
- 원문 앱 키는 생성 직후 한 번만 표시되고 DB에는 해시와 접두어만 저장됩니다.
- 앱은 승인된 내부 영상 카탈로그 JSON만 동기화합니다.
- 앱 키는 최초 등록된 설치 ID에 바인딩되며, 다른 앱에서 재사용하려면 새 키를 만들어야 합니다.
- 저장된 키는 앱 설정에서 평문으로 다시 표시하지 않습니다.
- 앱은 시작하거나 다시 전면으로 돌아올 때마다 저장된 카탈로그 버전을 확인하고, 버전이 달라진 경우에만 새 승인 목록을 받습니다.
- 기간 제한 없이 가족당 전체 영상 20개까지 무료입니다. `최종관리자 > 사용자·가족 > 무료 영상 등록 한도`에서 결제 없이 한도를 확대할 수 있습니다. 기존 체험·결제 날짜는 접근 권한에 영향을 주지 않습니다.
- 관리자 접근 경로 `관리자 화면 > 대시보드 > 앱 접속 정책`에서 목록 수신 환경을 `Wi-Fi만` 또는 `Wi-Fi + 모바일 데이터`로 정합니다.
- 앱이 통신 정책을 확인하지 못하면 `Wi-Fi 필수=true`로 처리하고 실제 목록 대신 재생되지 않는 샘플 화면을 표시합니다.

## 배포 방향

웹과 `android-client/`는 당분간 이 저장소 하나에서 관리합니다. 다만 웹 운영 배포와 Android APK/AAB 산출물은 독립된 CI 작업과 승인 절차로 운영합니다. Web CI, Android 로직 CI와 Android debug APK CI는 서로 다른 변경 경로로 실행됩니다. debug artifact는 Android 기본 debug signing만 사용하며 스토어 배포용 릴리스가 아닙니다.

현재 코드는 동적 Next.js 서버, Prisma/SQLite 쓰기와 `public/uploads/thumbnails/` 로컬 파일 쓰기에 의존하므로 Cloudflare Pages 정적 사이트로 그대로 배포할 수 없습니다. 1차 운영은 영구 디스크가 있는 단일 Node 서버에 배포하고 Cloudflare DNS·TLS·Access를 앞단에 둡니다. SQLite DB와 커스텀 썸네일 폴더는 앱 쓰기를 멈춘 같은 시점으로 백업하고 복구 시험을 해야 합니다. 실행 명령과 접근 경로는 `docs/OPERATIONS_RUNBOOK.md`를 따릅니다.

후속 전환은 아래 순서로 진행합니다.

1. SonTube 전용 Supabase 프로젝트에 PostgreSQL schema와 가족별 RLS를 준비합니다.
2. 보호자 Auth, 앱 키·동기화·결제용 권한 함수, 커스텀 썸네일 Storage를 서비스 전용 경계로 옮깁니다.
3. 기존 SQLite 행 수·관계와 업로드 파일을 검증하며 이관합니다.
4. 웹을 정적 SPA/PWA로 재구성하고 SonTube 전용 Cloudflare Pages 프로젝트에 배포합니다.
5. `SONTUBE_RELEASE_APP_URL=https://<운영-도메인>/app`으로 Android 릴리스를 다시 빌드하고 실제 기기 회귀 QA를 합니다.

Cloudflare 계정과 `jjunybox.com` DNS 존만 다른 서비스와 공유합니다. Museum·Arcade 또는 다른 서비스의 저장소, Pages 프로젝트, Supabase 프로젝트, 데이터와 service role은 공유하지 않습니다.

### Cloudflare Access 수동 설정

시작 위치는 Cloudflare Dashboard의 `Zero Trust > Access controls > Applications`입니다. `Create new application > Self-hosted and private > Add public hostname`으로 이동합니다. 공식 경로 설명은 [Cloudflare self-hosted application 문서](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)와 [Application paths 문서](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)를 함께 확인합니다.

1. `SonTube Admin` 애플리케이션을 만들고 운영 도메인의 `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*`, `/kids`, `/kids/*`를 등록합니다. `Allow` 정책의 `Include > Emails`에는 초대한 실제 보호자들을 포함해야 합니다. 기존 두 이메일만 허용하는 정책은 일반 가족을 차단합니다. `ADMIN_ALLOWED_EMAILS`는 Lite 공개 운영자 설정이지 이 접근 목록이 아닙니다.
2. `SonTube Superadmin` 애플리케이션을 별도로 만들고 `/superadmin`, `/superadmin/*`를 등록합니다. `Allow` 정책에는 소유자 이메일 하나만 넣습니다.
3. 호스트 전체를 보호하는 광범위한 Access 애플리케이션은 만들지 않습니다. `/`, `/lite`, `/api/lite/*`, `/app`, `/api/app/*`는 Access 로그인 없이 열려야 합니다. 특히 Android 시작 정책과 앱 키 API 앞에 이메일 로그인을 두면 앱이 구동되지 않습니다.
4. 경로 와일드카드는 부모 경로 자체를 포함하지 않으므로 `admin`과 `admin/*`처럼 두 경로를 모두 등록합니다. 더 구체적인 경로 정책이 우선 적용되므로 저장 후 각 URL을 직접 확인합니다.
5. 시크릿 창에서 공개 경로는 로그인 없이 열리고, 관리자 경로는 등록된 이메일만 통과하며, 최종관리자 경로는 소유자만 통과하는지 확인합니다. Cloudflare Access를 통과해도 SonTube 자체 로그인은 계속 요구되어야 합니다.
6. 원본 서버 주소나 대체 배포 도메인으로 Access를 우회할 수 없는지 확인합니다. 공개 원본이 남아 있으면 Cloudflare Tunnel의 Access 보호 또는 원본의 Access 토큰 검증을 추가합니다.

## 무료 운영과 과거 결제 기록

- 아이가 사용하는 `/app` 화면에는 광고를 넣지 않습니다.
- YouTube iframe 자체 광고는 YouTube 플레이어 정책에 따라 노출될 수 있으며 SonTube가 차단하거나 변조하지 않습니다.
- 가족당 전체 영상 20개가 기본이며 최종관리자만 사유·감사 로그와 함께 무료 한도를 변경합니다. 한도 축소나 기존 초과 데이터는 삭제하지 않습니다.
- 신규 결제는 서버에서 차단합니다. 부모 화면의 계좌·상품·입금 신청은 제거하고 과거 내역·환불만 보존합니다. `PAYMENT_*`는 무료 운영 필수 설정이 아닙니다.
- 보호자는 `관리자 > 대시보드`에서 사용량을, `무료 이용 안내`에서 정책과 과거 내역을 확인합니다.
- 배포 전 백업 후 프로젝트 루트 `C:\codex\app\sontube`에서 `npm run db:migrate`를 실행하고 재시작해야 합니다. SQLite 한도·카탈로그 트리거를 설치하므로 `db:push`로 대체하지 않습니다.
- 현재 운영 정책은 `docs/DECISIONS.md`의 D040·D041을 따릅니다. 향후 유료화는 별도 정책·사업자 검토 대상입니다.
## 추가 문서

- `android-client/README.md`: Android Studio 실행, 서버 주소, APK 빌드 경로
- `docs/ANDROID_APP_PLAN.md`: 부모 웹/아이 앱 구분과 Android 제한 범위
- `docs/MONETIZATION_NOTES.md`: 14일 체험과 광고 정책 메모
- `docs/MANUAL_PAYMENT_OPERATION.md`: 사업용 계좌이체, 최종관리자 처리, 환불과 배포 환경변수
- `docs/OPERATIONS_RUNBOOK.md`: 운영 사전점검, 헬스체크, SQLite·썸네일 백업/검증/복구 절차

## 앱 래퍼 주의사항

Android 클라이언트는 origin만 비교하지 않고 정확한 `/app` 경로만 최상위 화면으로 허용합니다. `/admin`, `/kids`, 외부 URL, 새 창은 차단됩니다. 기기 자체에서 다른 앱 실행까지 줄이려면 Android의 화면 고정을 함께 설정하거나 관리형 기기 Lock Task를 후속 적용해야 합니다.
