# SonTube Codex Handover

Updated: 2026-08-30

## Resume Point

- Project root: `C:\codex\app\sontube`
- Repository: `https://github.com/seamoon23/sontube.git`
- Branch: `main`
- Parent surface: Next.js administrator web UI
- Child surface: native Android WebView client loading only `/app`

Start every new session inside `C:\codex\app\sontube`. Do not treat `C:\codex\app` as the project root and do not inspect or modify sibling projects.

## Product Contract

SonTube is a parent-managed family video drawer. Parents manually register and approve individual YouTube videos. Children choose only from that catalog using internal search, tags, parent recommendations, a local playlist and short feedback signals.

The child experience must not expose a general browser, address bar, administrator controls, YouTube-wide search, comments or external YouTube channel navigation. The product does not use the YouTube Data API, Google API keys or paid AI APIs.

## Implemented

### Parent Web

- Family-scoped parent email/password authentication backed by `ParentUser` and `SESSION_SECRET`
- Video registration, editing, filtering, safety state and publication state
- Family-scoped channel management at `/admin/channels`, including rename, new-selection deactivation and duplicate merge
- Existing-channel selection or direct channel-name entry during video registration and editing
- Channel filtering on the administrator video list; videos may remain unassigned
- Tag management and local recommendation rules
- YouTube/default, custom upload and placeholder thumbnail handling
- Parent recommendation flag and recent recommendation section
- Interest summary for 7 days, 30 days and all time
- Child feedback and playlist-signal summaries
- Copyable, statistics-based prompt for analysis in an external AI tool
- Mobile-friendly navigation, skip link and menu-specific slide guides
- Administrator-only bottom sponsor/ad placeholder
- Bounded process-local rate limiting for parent/superadmin login and payment/refund requests
- `nosniff`, same-origin framing, referrer and restricted browser-capability response headers
- Search indexing and shared caching disabled for administrator, child and API route families

### App Sync

- Administrator-generated app keys
- Raw key shown once; database stores SHA-256 hash and prefix
- First registration binds a key to one installation ID
- 14-day trial state with future `paidUntil` entitlement field
- `/api/app/register` and `/api/app/sync`
- Approved catalog JSON only, with nullable channel metadata
- Parent-managed Wi-Fi-only or all-network catalog policy; missing policy defaults to Wi-Fi required
- Catalog-version check on every app start and foreground return; catalog payload only when changed
- Replacement key and cache change only after successful server registration
- Key deactivation from the administrator UI
- Bounded process-local sync rate limiting with hashed identifiers

### Child App Surface

- Key required before the catalog is shown
- Local cache of the latest approved catalog
- Search over parent-written title, description, search keywords and tags
- Optional channel labels and a same-channel view filtered locally to approved, public videos
- Tag filters, hot tags and recent parent recommendations
- Local child playlist
- Short feedback signals: like, rewatch, curious, funny, too hard and dislike
- Parent math gate before settings
- No SonTube ads; YouTube iframe ads may still appear
- Same-video loop reduces end-of-video recommendation transitions
- No free-trial card or trial end date on the child surface
- Ten searchable/filterable non-playing samples replace approved content during connection fallback

### Android Client

- Native Java Android project under `android-client/`
- Address-bar-free WebView
- Exact scheme, host, effective port and `/app` top-level URL allowlist
- Blocks `/admin`, `/kids`, external hosts, custom schemes, new windows and downloads
- Disables file/content access and denies permission requests
- Does not restore WebView navigation history
- Rechecks back destinations and History API URL updates
- Full-screen iframe playback without forced orientation recreation
- Persists a native installation ID, fetches `/api/app/policy?installationId=...` before WebView startup and checks the family Wi-Fi policy
- Shows six local non-playing samples when startup policy/network checks fail
- Keeps a native fallback visible after main-frame network failures
- While visible, immediately hides playback on network loss and rechecks server policy before restoring after Wi-Fi/mobile/network changes
- Android 13+ predictive Back uses the same full-screen, trusted-history and task-background rules as legacy Back
- App data backup/device transfer disabled and a code-based launcher icon packaged
- Debug HTTP URL separated from required release HTTPS URL
- Gradle 8.13 Wrapper and Android API 36 build

## Important Boundaries

1. The WebView prevents top-level navigation to arbitrary websites. A normal Android app cannot by itself prevent Home/Recent Apps. For household use, enable Android screen pinning at `Settings > Security or Security & privacy > More security settings > App pinning`. A fully managed kiosk requires Device Owner/DPC Lock Task.
2. YouTube playback remains a YouTube iframe. SonTube does not remove ads or fully control every internal player element. The sandbox and same-video loop reduce escape/recommendation paths, but real-device testing remains mandatory.
3. The child playlist is local to the app/WebView storage. Playlist actions also create aggregate parent-interest signals, but there is no server-synced editable playlist model yet.
4. Manual prepaid bank-transfer payment is implemented for parent web with separate superadmin approval. Public sales still require real business, refund, receipt and store-distribution policy review.
5. Rate limiting is bounded but process-local. Before multi-instance public hosting, configure a trusted proxy and replace it with a shared persistent limiter.
6. Channel grouping never discovers or imports YouTube content. Parents still register each video individually, and the child app never opens an external channel page.

## Main Routes

- `/admin/login`: administrator login
- `/admin`: dashboard
- `/admin/videos`: video list
- `/admin/videos/new`: register video
- `/admin/channels`: family channel rename, new-selection deactivation, duplicate merge and filtered-video entry point
- `/admin/tags`: tag management
- `/admin/insights`: parent interest summary
- `/admin/app-keys`: app key management
- `/admin/payment`: parent pass, bank-transfer application and history
- `/superadmin/login`: environment-only operations login
- `/superadmin/payments`: deposit and refund processing
- `/app`: child app content surface
- `/api/app/policy?installationId=...`: public non-secret family catalog network policy; unknown installations fail closed to Wi-Fi required
- `/api/app/register`: first key registration
- `/api/app/sync`: catalog refresh

The Android client intentionally blocks `/admin` and `/kids`.

## Local Web Setup

From PowerShell:

```powershell
cd C:\codex\app\sontube
npm install
npm run db:generate
npm run db:init
npm run db:status
```

Create `.env` from `.env.example`. Never commit `.env`.

Create or reset the administrator password:

```powershell
npm run auth:hash -- <새비밀번호> <새세션비밀키>
```

Put the printed password hash in `ADMIN_PASSWORD_HASH` and the same session secret in `SESSION_SECRET`, then restart the server.

Run locally:

```powershell
npm run dev
```

Open `http://127.0.0.1:3000/admin/login`.

For an Android device on the same Wi-Fi:

```powershell
npm run dev:lan
```

Then set `SONTUBE_DEBUG_APP_URL=http://<PC-LAN-IP>:3000/app` in `android-client/gradle.properties` and rebuild the APK.

## Android Build

From PowerShell:

```powershell
cd C:\codex\app\sontube\android-client
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug
```

APK output:

```text
C:\codex\app\sontube\android-client\app\build\outputs\apk\debug\app-debug.apk
```

Android Studio path:

```text
File > Open > C:\codex\app\sontube\android-client
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

The APK is a local build artifact and is intentionally not committed.

## Last Verified

The following passed on 2026-08-30:

```powershell
npm run verify:web
npm run verify:android:logic
cd android-client
.\gradlew.bat lintDebug
.\gradlew.bat assembleDebug
```

- Fresh temporary SQLite database: all 3 migrations applied; Prisma generate and validate passed
- TypeScript and ESLint: passed
- Vitest: 20 files, 84 tests passed
- Next.js production build: passed
- Generated `/robots.txt` and sensitive-route noindex/no-store configuration tests: passed
- Java `NavigationPolicySmokeTest`: passed
- Java `WebViewLoadStateSmokeTest`: passed
- Java `StartupPolicySmokeTest`: passed
- Java `RuntimeNetworkGuardSmokeTest`: passed
- Android `lintDebug`: 0 errors; only the deferred Gradle update advisory remains
- Gradle 8.13 `assembleDebug`: passed
- Prisma baseline, family/payment and video-channel migrations: fresh database and existing local database passed
- Browser QA: parent/superadmin protected-route redirects and 390 px login layouts passed
- Release HTTPS URL validation task: passed with a valid sample URL

## Current Emulator QA

- Pixel XL emulator, Android 12 / API 32, Android System WebView 120.0.6099.193
- Debug APK build/install, app-key registration, playback, full screen and Back recovery passed
- `/admin`, external URL, new-window and History API escape checks passed
- Android app pinning reached `PINNED`; Back, Home and Recents remained in SonTube
- Parent Wi-Fi policy endpoint, Android Wi-Fi transport gate and fail-closed native samples passed
- Unchanged `catalogVersion` returned `catalog: null`; invalid replacement key preserved the old key/cache
- Open WebView changed to ten samples with zero iframes after the five-second connection timeout
- Sample search returned the single expected `공룡 발자국 찾기` card
- 2026-07-30 readiness check found the SDK ADB executable and existing debug APK, but `adb devices -l` returned no attached device or running emulator
- Navigation policy, WebView load-state and startup-policy Java smoke tests passed again; `assembleDebug` also completed successfully with all 35 Gradle tasks up to date
- Physical-device cellular/all-network and manufacturer-specific app-pinning verification remains pending
- Repeatable steps and a device record table are in `docs/ANDROID_QA_CHECKLIST.md`
- 2026-08-24 automation added visible-state network transition guarding, Android 13+ Back handling, backup/transfer exclusion, a launcher icon, Android logic CI, Android lint, a fresh debug APK, and repeatable Web CI; no physical-device result was inferred from these checks

## Next Work Order

1. Install the debug APK on at least one physical Android device.
2. Test Wi-Fi-required and all-network policy modes on real Wi-Fi and mobile data.
3. Repeat key registration, versioned sync, playback, full screen, escape blocking and network fallback/recovery.
4. Record manufacturer-specific screen-pinning behavior and the exact unpin gesture.
5. Decide whether ordinary screen pinning is sufficient or a managed-device Lock Task track is required.
6. Add parent PIN or Android device authentication around app settings.
7. Review persistent rate limiting and production database strategy before hosting.
8. Review web payment entitlement and store policy only after the device experience is stable.
## Key Files

- `AGENTS.md`: product and repository working rules
- `README.md`: project setup and feature overview
- `docs/PRODUCT_BRIEF.md`: product scope
- `docs/DECISIONS.md`: architectural decisions
- `docs/TODO.md`: current backlog
- `docs/ANDROID_APP_PLAN.md`: Android boundaries and QA checklist
- `docs/ANDROID_QA_CHECKLIST.md`: repeatable emulator/physical-device QA and current results
- `docs/ANDROID_PARENT_AUTH_DESIGN.md`: device-credential-first settings protection design and QA boundary
- `docs/MONETIZATION_NOTES.md`: deferred monetization notes
- `prisma/schema.prisma`: data model
- `components/app/app-shell.tsx`: child app UI and sync/cache behavior
- `lib/app-access.ts`: app key and entitlement rules
- `lib/app-catalog.ts`: approved catalog projection and stable catalog version
- `lib/channels.ts`: family-scoped channel normalization, lookup and video-form resolution
- `lib/app-policy.ts`: Wi-Fi requirement default and database policy read
- `lib/app-fallback-catalog.ts`: ten non-playing layout/filter samples
- `lib/app-sync.ts`: API request validation and sync policy
- `lib/rate-limit.ts`: bounded process-local fixed-window limiter and hashed identifiers
- `scripts/verify-web.mjs`: temporary-DB migration, type, lint, test and production-build verification
- `.github/workflows/web-ci.yml`: Node 22 web verification workflow
- `.github/workflows/android-logic-ci.yml`: Java 17 policy smoke-test workflow
- `android-client/app/src/main/java/com/sontube/client/MainActivity.java`: restricted WebView
- `android-client/app/src/main/java/com/sontube/client/NavigationPolicy.java`: top-level URL policy
- `android-client/app/src/main/java/com/sontube/client/WebViewLoadState.java`: main-frame error state
- `android-client/app/src/main/java/com/sontube/client/StartupPolicy.java`: fail-closed startup decision and policy parser
- `android-client/app/src/main/java/com/sontube/client/RuntimeNetworkGuard.java`: visible-state network transition decisions
- `scripts/verify-android-logic.mjs`: cross-platform compile/run wrapper for the four pure-Java Android policy tests
- `android-client/tools/webview-cdp-eval.mjs`: repeatable debug WebView diagnostics

## Prompt For The Next Chat

```text
SonTube 작업을 이어가 주세요.

프로젝트 루트:
C:\codex\app\sontube

먼저 아래 파일을 순서대로 읽고 현재 Git 상태를 확인하세요.
1. AGENTS.md
2. docs/codex-handover.md
3. docs/TODO.md
4. docs/DECISIONS.md
5. android-client/README.md

상위 C:\codex\app 폴더와 형제 프로젝트는 읽거나 수정하지 마세요.
기존 변경을 임의로 되돌리지 말고, 작업 전 pwd, git status, 주요 파일 구조를 확인해 주세요.

현재 최우선 목표는 Android 실제 기기 QA입니다.
- debug APK 설치
- 앱 키 등록과 승인 카탈로그 동기화
- 접속·복귀마다 카탈로그 버전 확인과 변경 목록 수신
- YouTube 재생과 전체 화면
- 외부 URL, 새 창, 뒤로가기 차단
- 화면 고정 동작
- 네트워크 오류 후 샘플 화면과 복구
- Wi-Fi 필수/전체 허용 정책을 실제 Wi-Fi와 모바일 데이터에서 확인

Android 기기나 에뮬레이터를 바로 사용할 수 없다면, 실행 가능한 자동 검증과 QA 체크리스트를 먼저 보강하고 다음으로 부모 PIN/기기 인증 설계를 진행하세요.

YouTube Data API, Google API Key, 전체 검색, 댓글/자막 수집, 영상 다운로드, 광고 차단, 유료 AI API는 구현하지 마세요.

작업 계획과 수정 대상 파일을 먼저 짧게 알린 뒤 구현, 테스트, 빌드까지 진행하고 결과를 정리해 주세요.
```

## Manual Payment And Tenant Update (2026-07-30)

- 보호자는 `ParentUser`로 로그인하고 모든 관리 데이터는 `Family` 단위로 격리한다.
- 기존 전역 영상·태그·앱 키는 bootstrap 가족에 귀속했으며 로컬 DB orphan 수는 모두 0으로 확인했다.
- 부모 결제 경로는 `/admin/payment`, 최종관리자 경로는 `/superadmin/login`이다.
- 최종관리자는 사용자·가족, 요금제, 입금 신청, 환불, 감사 로그를 관리하고 보호자 계정으로 30분 대체 로그인할 수 있다.
- 대체 로그인은 비밀번호 재확인과 사유를 요구하며 결제·환불·계정 보안 작업을 차단한다.
- 결제는 활성 상품의 서버 가격·기간을 스냅샷으로 저장하고, 승인 트랜잭션이 `FamilySubscription`, `SubscriptionGrant`, 앱 키 `paidUntil`, 감사 로그를 함께 반영한다.
- 환불은 부모 요청 후 운영자가 실제 송금을 완료한 다음 최종관리자 화면에서 기록한다. 현재 전액·최신 활성 지급 건만 지원한다.
- 실제 사업자·계좌 값은 `PAYMENT_*` 비밀 환경변수에만 둔다. 상품 seed는 0원·비활성이고 최종관리자 화면에서 가격 설정 후 활성화한다.
- 마이그레이션은 `20260702000000_baseline`, `20260730090000_add_family_manual_payment`, `20260730120000_add_video_channels` 순서이며, 빈 DB 적용 후 현재 schema와 diff가 없음을 확인했다. 운영 가이드는 `docs/MANUAL_PAYMENT_OPERATION.md`다.
- Android 네이티브 설치 ID를 영속 저장하고 `/api/app/policy?installationId=...`로 가족별 Wi-Fi 정책을 조회한다. 등록 성공 시 동일 설치 ID의 이전 앱 키 바인딩은 해제된다.

### Local Database Migration Record

- 결제 적용 전 백업: `prisma/dev.before-payment-20260730.db` (gitignored)
- 채널 적용 전 백업: `prisma/dev.before-channel-20260730.db` (gitignored)
- 적용 migrations: `20260702000000_baseline`, `20260730090000_add_family_manual_payment`, `20260730120000_add_video_channels`
- seed 후 검증: Family 1, ParentUser 1, Video orphan 0, Tag orphan 0, AppAccessKey orphan 0, PaymentPlan 2
- `npx prisma migrate status`: schema up to date

## Channel Grouping Update (2026-07-30)

- 가족별 `Channel` 마스터를 추가하고 `Video.channelId`는 nullable로 유지했다. 기존 영상은 채널 미지정 상태로 그대로 동작한다.
- 보호자는 영상 등록·수정에서 기존 채널을 선택하거나 새 채널명을 직접 입력한다.
- `/admin/channels`에서 채널별 등록·공개 승인 영상 수를 확인하고, 이름 변경·신규 선택 비활성화·중복 채널 병합을 관리한다. 비활성화해도 기존 영상 연결과 앱의 채널 묶음은 유지된다.
- 앱 카탈로그는 nullable 채널 정보를 전달하며, 같은 채널 보기는 현재 가족의 승인·공개 영상만 `channelId`로 로컬 필터링한다.
- 외부 YouTube 채널 이동, 채널 영상 자동 수집, YouTube Data API 또는 Google API Key 사용은 없다.
- migration `20260730120000_add_video_channels` 적용 후 기존 Video 1편이 채널 미지정으로 보존됨을 확인했다.
- 전체 Vitest 18 files/75 tests와 Next.js production build 통과를 확인했다.
- 임시 QA DB 브라우저 검증에서 이름 변경, 신규 선택 비활성화, 등록 폼의 비활성 채널 제외, 영상 이동·원본 삭제 병합과 병합 성공 문구를 확인했고 브라우저 오류는 0건이었다. 임시 DB와 서버는 정리했다.

### Remaining Priority

1. 실제 기기 Android QA를 완료한다.
2. 공개 운영 전 실제 `PAYMENT_*`와 별도 `SUPERADMIN_*` 비밀값을 배포 환경에 설정한다.
3. 최종관리자에서 상품 가격을 정하고 활성화한 뒤 테스트 입금 신청→승인→연장→환불 전체 흐름을 스테이징에서 확인한다.
4. 사업자등록·통신판매·환불·현금영수증 정책을 실제 판매 조건에 맞춰 확정한다.
5. 운영 전 최종관리자 2단계 인증, 영속 rate limit, DB·업로드·환경변수 복구 테스트를 보강한다.
