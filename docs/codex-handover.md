# SonTube Codex Handover

Updated: 2026-09-26

## Resume Point

- Project root: `C:\codex\app\sontube`
- Repository: `https://github.com/seamoon23/sontube.git`
- Branch: `main`
- Public web surface: parent brochure at `/` and read-only common catalog at `/lite`
- Parent surface: Next.js administrator web UI
- Child surface: native Android WebView client loading only `/app`

Start every new session inside `C:\codex\app\sontube`. Do not treat `C:\codex\app` as the project root and do not inspect or modify sibling projects.

## Product Contract

SonTube is a parent-managed family video drawer. Parents manually register and approve individual YouTube videos. Children choose only from that catalog using internal search, tags, parent recommendations, a local playlist and short feedback signals.

The child experience must not expose a general browser, address bar, administrator controls, YouTube-wide search, comments or external YouTube channel navigation. The product does not use the YouTube Data API, Google API keys or paid AI APIs.

## Implemented

### Parent Web

- Family-scoped parent email/password authentication backed by `ParentUser`, `SESSION_SECRET` and `ADMIN_ALLOWED_EMAILS`
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
- Final-administrator-only payment and refund reconciliation CSV export without free-form memos or internal IDs
- Bounded process-local rate limiting for parent/superadmin login and payment/refund requests
- `nosniff`, same-origin framing, referrer and restricted browser-capability response headers
- Search indexing and shared caching disabled for administrator, child and protected API route families; the explicit Lite API is the public exception

### Public Web / Lite

- `/` is reserved for a parent-facing product brochure rather than a child or administrator entry point
- `/lite` is a public, read-only common trial and is separate from the app-key family catalog
- Lite is initially `noindex`; public availability does not imply search-indexing intent
- A video enters Lite only when `isLitePublished`, `isPublished`, `PARENT_CHECKED` and an active family are all true
- Lite order is `liteSortOrder` ascending, then recent update and stable ID order
- `GET /api/lite/catalog` returns the AppCatalog-compatible public projection with `source: "LIVE"` and a weak ETag; browsers revalidate every response and shared CDN freshness is capped at 60 seconds
- The checked-in JSON Schema is applied to the actual route 200 response in tests together with 304 and 503 cache behavior
- Lite excludes family ID, original YouTube URL, app keys, payment, entitlement and server feedback data
- An empty Lite catalog stays empty; it never falls back to Android samples or a private cached family catalog
- Lite supports local search/filter/playback and a `localStorage` playlist only; device pinning and Wi-Fi enforcement remain Android responsibilities

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
- Search over parent-written title, search keywords and tags; administrator description is not a search field
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
7. The current dynamic Next.js, SQLite and local upload implementation is not a static Cloudflare Pages build. Use a single persistent-disk Node host first or complete the Supabase/static-app migration before Pages.
8. Cloudflare Access is defense in depth for administrator paths. It must not replace SonTube sessions or intercept public Lite and Android app-key endpoints.

## Main Routes

- `/`: public parent brochure
- `/lite`: public read-only common catalog; no family/app-key features
- `/api/lite/catalog`: public explicitly-published Lite catalog
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

## Repository And Delivery Topology

- Keep web and `android-client/` in this one repository while their shared API/catalog contract is evolving.
- Run web verification/deployment and Android policy verification/signed artifact generation as independent CI pipelines.
- A web-only change must not automatically publish an APK/AAB, and an Android artifact job must not deploy the web application.
- Use a SonTube-specific deployment, database, storage and secrets boundary. Only the Cloudflare account and `jjunybox.com` DNS zone are shared with other jjunybox services.

## Hosting Plan

### Stage 1 - Current Next.js Runtime

1. Deploy the dynamic Next.js server to one Node host with persistent disk.
2. Keep SQLite and `public/uploads/thumbnails/` on persistent storage. Use `npm run ops:backup`, verify the manifest and perform a restore drill with application writes paused.
3. Put the selected `jjunybox.com` subdomain behind Cloudflare DNS/TLS.
4. Configure the path-scoped Cloudflare Access policies below without covering the public host as a whole.
5. Run web production build, login boundaries, Lite exposure and Android physical-device regression tests before opening the domain.

### Stage 2 - Cloudflare Pages And Supabase

1. Create a separate SonTube Supabase project; do not reuse a Museum, Arcade or other service project.
2. Migrate the schema to PostgreSQL, map parent users to Auth and enforce family ownership with RLS.
3. Move custom thumbnails to service-specific Storage and privileged app-key, payment and superadmin operations to reviewed functions.
4. Replace process-local rate limiting with a persistent or edge-coordinated limiter.
5. Convert the web application to a static SPA/PWA and reproduce restricted-route headers, real 404 behavior and safe service-worker caching.
6. Deploy the static output to a separate SonTube Cloudflare Pages project, migrate data with a write freeze and retain a tested rollback window.
7. Rebuild Android with the final HTTPS `/app` URL and repeat key, playback, full-screen, escape-blocking and network-recovery QA.

The existing `next build` + `next start`, Prisma/SQLite write path and Node filesystem thumbnail path cannot be copied directly to static Pages.

## Cloudflare Access Manual Setup

Start in Cloudflare Dashboard at `Zero Trust > Access controls > Applications`, then choose `Create new application > Self-hosted and private > Add public hostname`.

1. Create `SonTube Admin`. Add both the parent path and its wildcard because a wildcard does not include the parent path: `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*`, `/kids`, `/kids/*`.
2. Add an `Allow` policy with `Include > Emails` containing exactly the same two operating-parent emails configured in `ADMIN_ALLOWED_EMAILS`.
3. Create a separate `SonTube Superadmin` application for `/superadmin` and `/superadmin/*`. Its `Allow` policy contains only the owner's email.
4. Do not create a hostname-wide Access rule. `/`, `/lite`, `/api/lite/*`, `/app` and `/api/app/*` must remain outside Access; `/api/app/*` continues to use app-key and installation-ID authorization.
5. Test in a private browser window: public paths open without Access, the two parent emails can reach administrator paths, other emails cannot, and only the owner can reach superadmin paths. Passing Access must still lead to the SonTube login rather than bypassing it.
6. Verify that the origin hostname or an alternate deployment URL cannot bypass the administrator Access policy. Restrict the origin or validate Access tokens if a direct origin remains reachable.

Cloudflare references: [self-hosted applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/), [application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/).

## Local Web Setup

From PowerShell:

```powershell
cd C:\codex\app\sontube
npm install
npm run db:generate
npm run db:init
npm run db:status
```

Create `.env` from `.env.example`. Never commit `.env`. Set `ADMIN_ALLOWED_EMAILS` to exactly the two active operating-parent emails, including the bootstrap email. Create the second `ParentUser` from `최종관리자 > 사용자` (`/superadmin/users`) after bootstrap setup.

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

GitHub Actions debug artifact path:

```text
SonTube 저장소 > Actions > Android Debug APK > Run workflow
완료된 실행 > Artifacts > sontube-android-debug-only-<commit SHA>
```

This workflow runs `lintDebug assembleDebug`, uses Android's standard debug signing and retains the artifact for 14 days. It does not publish a store release or deploy the web application.

The APK is a local build artifact and is intentionally not committed.

## Last Verified

The following passed on 2026-09-26:

```powershell
npm run verify:web
npm run verify:android:logic
cd android-client
.\gradlew.bat lintDebug
.\gradlew.bat assembleDebug
```

- Fresh temporary SQLite database: all 5 migrations applied; Prisma generate and validate passed
- TypeScript and ESLint: passed
- Vitest: 35 files, 159 tests passed
- Next.js production build: passed
- Generated `/robots.txt`, Lite crawl/noindex exception and protected-route no-store configuration tests: passed
- Lite JSON Schema against the actual 200 response, weak ETag 304 and 503 no-store tests: passed
- Lite browser QA with a temporary six-item public catalog at 320 px, 390 px and 1440 px: no horizontal page overflow; search/filter/channel/empty-state/local playlist, real YouTube iframe load, viewport-sized full-screen focus and close recovery passed
- Operational environment preflight and generic no-store DB health route tests: passed
- Authenticated payment/refund CSV export, no-store response and spreadsheet-formula neutralization tests: passed
- SQLite VACUUM snapshot, thumbnail checksum manifest, tamper detection, overwrite refusal and force-restore rollback tests: passed
- Independent Android debug-only APK workflow structure and local `lintDebug assembleDebug`: passed
- Java `NavigationPolicySmokeTest`: passed
- Java `WebViewLoadStateSmokeTest`: passed
- Java `StartupPolicySmokeTest`: passed
- Java `RuntimeNetworkGuardSmokeTest`: passed
- Android `lintDebug`: 0 errors; only the deferred Gradle update advisory remains
- Gradle 8.13 `assembleDebug`: passed
- Prisma baseline, family/payment, video-channel, Lite-catalog and parent-session-version migrations: fresh temporary database passed; run `prisma migrate deploy` before starting any existing deployment
- Browser QA: parent/superadmin protected-route redirects and 390 px login layouts passed
- Release HTTPS URL validation task: passed with a valid sample URL

## Current Emulator QA

- Pixel XL emulator, Android 12 / API 32, Android System WebView 120.0.6099.193
- 2026-08-30 debug APK reinstall, fresh app-key registration, three-item approved catalog sync and restart persistence passed
- Official YouTube iframe playback reached the playing state; native full screen occupied 1440 x 2560 with system bars hidden, and Back restored `/app` and the bars
- `/admin`, external URL, new-window and History API escape checks passed
- Android app pinning reached `PINNED`; Back, Home and Recents remained in SonTube
- With the local server stopped, the native fail-closed screen showed six non-playing samples and no WebView; restoring the server and tapping `연결 다시 확인` restored the registered three-item catalog
- Unchanged `catalogVersion` returned `catalog: null`; invalid replacement key preserved the old key/cache
- Open WebView changed to ten samples with zero iframes after the five-second connection timeout
- Sample search returned the single expected `공룡 발자국 찾기` card
- 2026-07-30 readiness check found the SDK ADB executable and existing debug APK, but `adb devices -l` returned no attached device or running emulator
- Navigation policy, WebView load-state and startup-policy Java smoke tests passed again; `assembleDebug` also completed successfully with all 35 Gradle tasks up to date
- Physical-device cellular/all-network and manufacturer-specific app-pinning verification remains pending
- Repeatable steps and a device record table are in `docs/ANDROID_QA_CHECKLIST.md`
- 2026-08-24 automation added visible-state network transition guarding, Android 13+ Back handling, backup/transfer exclusion, a launcher icon, Android logic CI, Android lint, a fresh debug APK, and repeatable Web CI; no physical-device result was inferred from these checks

## Next Work Order

1. Configure two real operating-parent accounts in `ADMIN_ALLOWED_EMAILS` and test allowed/denied logins without recording the addresses.
2. Select the persistent-disk Node host, run the checked-in preflight and backup/restore drill there, and configure path-scoped Cloudflare Access.
3. Install the release-candidate APK on at least one physical Android device using the final HTTPS `/app` URL.
4. On a physical device, test Wi-Fi-required and all-network modes, versioned sync, Android/Lite playback, full screen, escape blocking, manufacturer pinning and recovery.
5. Replace the process-local limiter before multi-instance or serverless public operation.
6. Plan the separate SonTube Supabase migration and static Pages conversion; do not attach SonTube to another service's project.
7. Add Android device authentication around app settings and complete payment/store-policy review before broader release.

## Key Files

- `AGENTS.md`: product and repository working rules
- `README.md`: project setup and feature overview
- `docs/PRODUCT_BRIEF.md`: product scope
- `docs/DECISIONS.md`: architectural decisions
- `docs/TODO.md`: current backlog
- `docs/OPERATIONS_RUNBOOK.md`: production preflight, health, backup, verification and guarded restore procedure
- `docs/ANDROID_APP_PLAN.md`: Android boundaries and QA checklist
- `docs/ANDROID_QA_CHECKLIST.md`: repeatable emulator/physical-device QA and current results
- `docs/ANDROID_PARENT_AUTH_DESIGN.md`: device-credential-first settings protection design and QA boundary
- `docs/MONETIZATION_NOTES.md`: deferred monetization notes
- `prisma/schema.prisma`: data model
- `components/app/app-shell.tsx`: child app UI and sync/cache behavior
- `lib/app-access.ts`: app key and entitlement rules
- `lib/app-catalog.ts`: approved catalog projection and stable catalog version
- `lib/lite-catalog.ts`: explicitly published public Lite catalog projection, ordering and ETag
- `app/api/lite/catalog/route.ts`: public read-only Lite catalog endpoint
- `lib/channels.ts`: family-scoped channel normalization, lookup and video-form resolution
- `lib/app-policy.ts`: Wi-Fi requirement default and database policy read
- `lib/app-fallback-catalog.ts`: ten non-playing layout/filter samples
- `lib/app-sync.ts`: API request validation and sync policy
- `lib/rate-limit.ts`: bounded process-local fixed-window limiter and hashed identifiers
- `scripts/verify-web.mjs`: temporary-DB migration, type, lint, test and production-build verification
- `scripts/check-production-env.mjs`: production secrets/configuration and persistent SQLite path preflight without printing values
- `scripts/backup-restore.mjs`: maintenance-mode SQLite/upload backup, verification and guarded restore
- `.github/workflows/web-ci.yml`: Node 22 web verification workflow
- `.github/workflows/android-logic-ci.yml`: Java 17 policy smoke-test workflow
- `.github/workflows/android-debug-apk.yml`: Android lint and debug-only APK artifact workflow
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

현재 최우선 목표는 공개 웹 경계와 1차 운영 배포 준비를 검증한 뒤 Android 실제 기기 QA를 완료하는 것입니다.
- `/` 부모 브로슈어와 `/lite` 공개 목록 경계
- Lite 명시 공개 조건, 빈 상태, 검색·필터·재생과 로컬 내 목록
- `ADMIN_ALLOWED_EMAILS` 두 계정과 Cloudflare Access 경로 분리
- 현재 Next/SQLite/업로드에 맞는 영구 디스크 Node 배포와 백업·복구
- Cloudflare Pages+SonTube 전용 Supabase 전환은 후속 단계로 유지
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
- 대체 로그인은 비밀번호 재확인과 사유를 요구하며 보호자 화면의 모든 데이터 변경을 차단한다.
- 결제는 활성 상품의 서버 가격·기간을 스냅샷으로 저장하고, 승인 트랜잭션이 `FamilySubscription`, `SubscriptionGrant`, 앱 키 `paidUntil`, 감사 로그를 함께 반영한다.
- 환불은 부모 요청 후 운영자가 실제 송금을 완료한 다음 최종관리자 화면에서 기록한다. 현재 전액·최신 활성 지급 건만 지원한다.
- 실제 사업자·계좌 값은 `PAYMENT_*` 비밀 환경변수에만 둔다. 상품 seed는 0원·비활성이고 최종관리자 화면에서 가격 설정 후 활성화한다.
- 현재 마이그레이션은 baseline, 가족·결제, 채널, Lite 카탈로그, 보호자 세션 버전의 5개 순서이며 빈 DB 적용을 검증했다. 운영 가이드는 `docs/MANUAL_PAYMENT_OPERATION.md`다.
- Android 네이티브 설치 ID를 영속 저장하고 `/api/app/policy?installationId=...`로 가족별 Wi-Fi 정책을 조회한다. 등록 성공 시 동일 설치 ID의 이전 앱 키 바인딩은 해제된다.

### Historical Local Database Migration Record (2026-07-30)

- 결제 적용 전 백업: `prisma/dev.before-payment-20260730.db` (gitignored)
- 채널 적용 전 백업: `prisma/dev.before-channel-20260730.db` (gitignored)
- 당시 적용 migrations: `20260702000000_baseline`, `20260730090000_add_family_manual_payment`, `20260730120000_add_video_channels`; 이후 2개 migration은 배포 전 별도 적용 필요
- seed 후 검증: Family 1, ParentUser 1, Video orphan 0, Tag orphan 0, AppAccessKey orphan 0, PaymentPlan 2
- `npx prisma migrate status`: schema up to date

## Channel Grouping Update (2026-07-30)

- 가족별 `Channel` 마스터를 추가하고 `Video.channelId`는 nullable로 유지했다. 기존 영상은 채널 미지정 상태로 그대로 동작한다.
- 보호자는 영상 등록·수정에서 기존 채널을 선택하거나 새 채널명을 직접 입력한다.
- `/admin/channels`에서 채널별 등록·공개 승인 영상 수를 확인하고, 이름 변경·신규 선택 비활성화·중복 채널 병합을 관리한다. 비활성화해도 기존 영상 연결과 앱의 채널 묶음은 유지된다.
- 앱 카탈로그는 nullable 채널 정보를 전달하며, 같은 채널 보기는 현재 가족의 승인·공개 영상만 `channelId`로 로컬 필터링한다.
- 외부 YouTube 채널 이동, 채널 영상 자동 수집, YouTube Data API 또는 Google API Key 사용은 없다.
- migration `20260730120000_add_video_channels` 적용 후 기존 Video 1편이 채널 미지정으로 보존됨을 확인했다.
- 당시 전체 Vitest 18 files/75 tests와 Next.js production build 통과를 확인했다. 현재 검증 수치는 위 `Last Verified`를 따른다.
- 임시 QA DB 브라우저 검증에서 이름 변경, 신규 선택 비활성화, 등록 폼의 비활성 채널 제외, 영상 이동·원본 삭제 병합과 병합 성공 문구를 확인했고 브라우저 오류는 0건이었다. 임시 DB와 서버는 정리했다.

### Historical Remaining Priority (superseded by `Next Work Order` above)

1. 실제 기기 Android QA를 완료한다.
2. 공개 운영 전 실제 `PAYMENT_*`와 별도 `SUPERADMIN_*` 비밀값을 배포 환경에 설정한다.
3. 최종관리자에서 상품 가격을 정하고 활성화한 뒤 테스트 입금 신청→승인→연장→환불 전체 흐름을 스테이징에서 확인한다.
4. 사업자등록·통신판매·환불·현금영수증 정책을 실제 판매 조건에 맞춰 확정한다.
5. 운영 전 최종관리자 2단계 인증, 영속 rate limit, DB·업로드·환경변수 복구 테스트를 보강한다.
