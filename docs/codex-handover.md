# SonTube Codex Handover

Updated: 2026-07-29

## Resume Point

- Project root: `C:\codex\app\sontube`
- Repository: `https://github.com/seamoon23/sontube.git`
- Branch: `main`
- Parent surface: Next.js administrator web UI
- Child surface: native Android WebView client loading only `/app`

Start every new session inside `C:\codex\app\sontube`. Do not treat `C:\codex\app` as the project root and do not inspect or modify sibling projects.

## Product Contract

SonTube is a parent-managed family video drawer. Parents manually register and approve individual YouTube videos. Children choose only from that catalog using internal search, tags, parent recommendations, a local playlist and short feedback signals.

The child experience must not expose a general browser, address bar, administrator controls, YouTube-wide search, comments or channel navigation. The product does not use the YouTube Data API, Google API keys or paid AI APIs.

## Implemented

### Parent Web

- Password-only administrator authentication backed by `ADMIN_PASSWORD_HASH` and `SESSION_SECRET`
- Video registration, editing, filtering, safety state and publication state
- Tag management and local recommendation rules
- YouTube/default, custom upload and placeholder thumbnail handling
- Parent recommendation flag and recent recommendation section
- Interest summary for 7 days, 30 days and all time
- Child feedback and playlist-signal summaries
- Copyable, statistics-based prompt for analysis in an external AI tool
- Mobile-friendly navigation, skip link and menu-specific slide guides
- Administrator-only bottom sponsor/ad placeholder

### App Sync

- Administrator-generated app keys
- Raw key shown once; database stores SHA-256 hash and prefix
- First registration binds a key to one installation ID
- 14-day trial state with future `paidUntil` entitlement field
- `/api/app/register` and `/api/app/sync`
- Approved catalog JSON only
- 24-hour recommended sync cadence and manual refresh
- Key deactivation from the administrator UI

### Child App Surface

- Key required before the catalog is shown
- Local cache of the latest approved catalog
- Search over parent-written title, description, search keywords and tags
- Tag filters, hot tags and recent parent recommendations
- Local child playlist
- Short feedback signals: like, rewatch, curious, funny, too hard and dislike
- Parent math gate before settings
- No SonTube ads; YouTube iframe ads may still appear
- Same-video loop reduces end-of-video recommendation transitions

### Android Client

- Native Java Android project under `android-client/`
- Address-bar-free WebView
- Exact scheme, host, effective port and `/app` top-level URL allowlist
- Blocks `/admin`, `/kids`, external hosts, custom schemes, new windows and downloads
- Disables file/content access and denies permission requests
- Does not restore WebView navigation history
- Rechecks back destinations and History API URL updates
- Full-screen iframe playback without forced orientation recreation
- Debug HTTP URL separated from required release HTTPS URL
- Gradle 8.13 Wrapper and Android API 36 build

## Important Boundaries

1. The WebView prevents top-level navigation to arbitrary websites. A normal Android app cannot by itself prevent Home/Recent Apps. For household use, enable Android screen pinning at `Settings > Security or Security & privacy > More security settings > App pinning`. A fully managed kiosk requires Device Owner/DPC Lock Task.
2. YouTube playback remains a YouTube iframe. SonTube does not remove ads or fully control every internal player element. The sandbox and same-video loop reduce escape/recommendation paths, but real-device testing remains mandatory.
3. The child playlist is local to the app/WebView storage. Playlist actions also create aggregate parent-interest signals, but there is no server-synced editable playlist model yet.
4. Payment is not implemented. Trial and `paidUntil` fields exist, but web payment and store-policy strategy are intentionally deferred.
5. Rate limiting is suitable for the local MVP and still needs a persistent or deployment-aware design before public hosting.

## Main Routes

- `/admin/login`: administrator login
- `/admin`: dashboard
- `/admin/videos`: video list
- `/admin/videos/new`: register video
- `/admin/tags`: tag management
- `/admin/insights`: parent interest summary
- `/admin/app-keys`: app key management
- `/app`: child app content surface
- `/api/app/register`: first key registration
- `/api/app/sync`: catalog refresh

The Android client intentionally blocks `/admin` and `/kids`.

## Local Web Setup

From PowerShell:

```powershell
cd C:\codex\app\sontube
npm install
npm run db:generate
npm run db:push
npm run db:init
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

The following passed before handover:

```powershell
npx tsc --noEmit
npm run lint
npm test
npx next build
```

- Vitest: 11 files, 37 tests passed
- Next.js production build: passed
- Java `NavigationPolicySmokeTest`: passed
- Gradle 8.13 `assembleDebug`: passed
- Release HTTPS URL validation task: passed with a valid sample URL

## Next Work Order

1. Install the debug APK on at least one emulator and one physical Android device.
2. Verify key registration, initial sync, manual refresh and 24-hour refresh metadata.
3. Test YouTube playback, full screen, Back, Home, Recent Apps, title/logo/new-window taps and network recovery.
4. Record manufacturer-specific screen-pinning behavior.
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
- `docs/MONETIZATION_NOTES.md`: deferred monetization notes
- `prisma/schema.prisma`: data model
- `components/app/app-shell.tsx`: child app UI and sync/cache behavior
- `lib/app-access.ts`: app key and entitlement rules
- `lib/app-catalog.ts`: approved catalog projection
- `lib/app-sync.ts`: API request validation and sync policy
- `android-client/app/src/main/java/com/sontube/client/MainActivity.java`: restricted WebView
- `android-client/app/src/main/java/com/sontube/client/NavigationPolicy.java`: top-level URL policy

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
- 수동 다시 불러오기
- YouTube 재생과 전체 화면
- 외부 URL, 새 창, 뒤로가기 차단
- 화면 고정 동작
- 네트워크 오류 후 복구

Android 기기나 에뮬레이터를 바로 사용할 수 없다면, 실행 가능한 자동 검증과 QA 체크리스트를 먼저 보강하고 다음으로 부모 PIN/기기 인증 설계를 진행하세요.

YouTube Data API, Google API Key, 전체 검색, 댓글/자막 수집, 영상 다운로드, 광고 차단, 유료 AI API는 구현하지 마세요.

작업 계획과 수정 대상 파일을 먼저 짧게 알린 뒤 구현, 테스트, 빌드까지 진행하고 결과를 정리해 주세요.
```
