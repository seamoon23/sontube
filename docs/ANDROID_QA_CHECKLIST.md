# SonTube Android QA Checklist

Updated: 2026-08-24

## Verified baseline

- Device: Android Emulator `Pixel_XL_API_32`
- OS: Android 12 / API 32
- APK: debug
- Server: `http://10.0.2.2:3000/app`

## Emulator result

- [x] Debug APK build and install
- [x] App key registration and approved catalog sync
- [x] Start/re-entry catalog-version check; unchanged catalog returns no list payload
- [x] YouTube playback
- [x] YouTube full screen and Back recovery
- [x] `/admin`, external URL, new window and History API escape blocking
- [x] Root Back returns to Home; relaunch starts at `/app`
- [x] Android app pinning blocks Back, Home and Recents after pin transition completes
- [x] Native connection fallback shows six non-playing local samples and no WebView
- [x] Retry recovers the registered catalog after network/server restoration
- [x] Open WebView switches to ten searchable/filterable samples within the 5-second timeout
- [x] Runtime network changes are guarded by a pure-Java state test and a fresh debug build
- [x] Invalid replacement key preserves the previous raw key and catalog cache
- [x] Child header does not show the free-trial status card
- [ ] Physical device and manufacturer-specific app pinning

The emulator used one local QA app key and the official YouTube iframe example video. The raw key is not stored in this document or source control.

### Latest physical-device readiness check (2026-07-30)

- Android SDK `platform-tools\adb.exe` was found and started successfully.
- `adb devices -l` returned no attached device or running emulator, so physical-device APK installation and manufacturer-specific checks remain pending.
- The existing debug APK was confirmed at `android-client\app\build\outputs\apk\debug\app-debug.apk`.
- `NavigationPolicySmokeTest`, `WebViewLoadStateSmokeTest` and `StartupPolicySmokeTest` passed again.
- A fresh `assembleDebug` retry completed successfully; all 35 Gradle tasks were up to date and the verified APK remains available.

### Latest automated readiness check (2026-08-24)

- `RuntimeNetworkGuardSmokeTest` now covers unchanged callbacks, Wi-Fi replacement, validation changes, mobile-data transitions, offline fail-closed behavior and callback shutdown.
- The four pure-Java policy/state smoke tests passed.
- Android `lintDebug` passed after adding Android 13+ predictive Back handling and isolating API 27-only resources/calls.
- App backup and device transfer are explicitly excluded, and a code-based launcher icon is packaged.
- A fresh `assembleDebug` passed and produced `android-client\app\build\outputs\apk\debug\app-debug.apk`.
- These automated checks do not mark physical-device playback, cellular policy or manufacturer-specific app pinning as passed.

## Start point

Open PowerShell and move to the project root:

```powershell
cd C:\codex\app\sontube
git status
```

For an emulator, keep `SONTUBE_DEBUG_APP_URL=http://10.0.2.2:3000/app` in `android-client/gradle.properties`.

Start the loopback-only web server:

```powershell
npm run dev
```

Build the APK from a second PowerShell window:

```powershell
cd C:\codex\app\sontube\android-client
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug
```

Install and launch it:

```powershell
cd C:\codex\app\sontube
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices -l
& $adb install -r "android-client\app\build\outputs\apk\debug\app-debug.apk"
& $adb shell am start -W -n com.sontube.client/.MainActivity
```

For a fresh registration test, use an unused app key. Do not clear app data on a device that contains a playlist or feedback state that must be preserved.

## Registration and catalog

- [ ] Before registration, no video catalog is visible.
- [ ] Enter the one-time raw key from the parent administrator screen.
- [ ] `등록하고 불러오기`가 동기화 성공을 알린다.
- [ ] Only `PARENT_CHECKED` and published videos appear.
- [ ] Restarting the app restores the registered catalog from local storage.
- [ ] Opening settings requires the parent check.
- [ ] Restart or background/restore the app and confirm `승인 목록이 최신입니다.` without replacing the cached catalog.
- [ ] Add an approved video, return to the app, and confirm the catalog version and list change.
- [ ] Enter an invalid replacement key and confirm the prior key prefix and catalog remain.
- [ ] The latest list-check timestamp updates; there is no manual refresh button.

Parent app-key menu path:

```text
SonTube 관리자 화면 > 앱 키 > 새 앱 키 만들기
```

## Playback and restricted navigation

- [ ] Tap Play and confirm the player reaches a playing state.
- [ ] Enter full screen, dismiss the Android immersive-mode guide if it appears, and confirm video remains visible.
- [ ] Press Back once in full screen and confirm the SonTube catalog returns.
- [ ] Tap YouTube title, logo, `Watch on YouTube`, share or copy-link affordances.
- [ ] Confirm Chrome, YouTube and other external apps do not open.
- [ ] Press Back at the root and confirm the task goes to the background rather than navigating to an older or forbidden page.
- [ ] Relaunch and confirm the top-level address is still `/app`.

The debug APK exposes a local-only WebView diagnostic socket. After the app is visible, use this repeatable escape check:

```powershell
cd C:\codex\app\sontube
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$appPid = (& $adb shell pidof com.sontube.client).Trim()
& $adb forward tcp:9222 "localabstract:webview_devtools_remote_$appPid"

node android-client/tools/webview-cdp-eval.mjs "document.location.href"
node android-client/tools/webview-cdp-eval.mjs "window.location.assign('/admin'); 'requested'"
node android-client/tools/webview-cdp-eval.mjs "window.location.assign('https://example.com/'); 'requested'"
node android-client/tools/webview-cdp-eval.mjs "window.open('https://example.com/','_blank') ? 'opened' : 'blocked'"
node android-client/tools/webview-cdp-eval.mjs "history.pushState({},'', '/admin'); document.location.href"
```

After each mutation, run the first command again. The final address must be `http://10.0.2.2:3000/app`, and the new-window expression must return `blocked`.

## Android app pinning

Enable it from the Android device:

```text
설정 > 보안 또는 보안 및 개인정보 보호 > 고급/기타 보안 설정 > 앱 고정
```

Pin SonTube:

```text
SonTube 실행 > 최근 앱 > SonTube 앱 아이콘 > 고정
```

- [ ] Wait until the `App is pinned` confirmation has completed.
- [ ] Back does not move SonTube to the background.
- [ ] Home does not open the launcher.
- [ ] Recents does not expose another task.
- [ ] Follow the device's displayed gesture or button combination to unpin.

Android 12 제스처 탐색은 고정 해제 방법으로 `위로 스와이프하고 길게 누르기`를 안내합니다. 3버튼 탐색과 제조사 빌드는 뒤로+최근 앱 조합을 사용할 수 있습니다. 정확한 모델, OS 버전, 탐색 방식과 해제 동작을 기록하세요.

## Network failure and recovery

Parent policy path:

```text
SonTube 관리자 화면 > 대시보드 > 앱 접속 정책 > Wi-Fi 연결 필수
```

- [ ] With `Wi-Fi 연결 필수` enabled, stop the app and turn off Wi-Fi or stop the test server.
- [ ] Launch the app without a reachable policy endpoint.
- [ ] Confirm the native `연결 전 샘플 화면` shows six sample rows, no approved title and no WebView player.
- [ ] Restore Wi-Fi/server and tap `연결 다시 확인`.
- [ ] Confirm the approved catalog and saved app registration return.
- [ ] While the approved catalog is open, stop the server and background/restore the app.
- [ ] Within five seconds, confirm ten sample cards, search/tag filtering and zero iframes.
- [ ] While the approved catalog or full-screen player is visible, turn Wi-Fi off and confirm the native samples replace it immediately.
- [ ] Restore an allowed network and confirm the app rechecks server policy before showing the WebView again.
- [ ] Switch directly between Wi-Fi and mobile data and confirm `Wi-Fi 연결 필수` blocks mobile data without briefly revealing the player.
- [ ] Turn `Wi-Fi 연결 필수` off and repeat once on mobile data on a physical device.
- [ ] Confirm local playlist, key and approved cache are not cleared during either fallback.

## Automated checks

From the project root:

```powershell
cd C:\codex\app\sontube
npm run verify:android:logic
```

The command compiles and runs all four pure-Java policy tests, then removes its temporary build directory. The same command runs in `.github\workflows\android-logic-ci.yml`. These checks do not replace physical-device playback, Android System WebView version differences or manufacturer-specific app-pinning tests.

## Physical-device record

| Device | Android | System WebView | Navigation | Playback/full screen | Escape blocking | App pinning | Network recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pixel XL emulator | 12 / API 32 | 120.0.6099.193 | Gesture | Pass | Pass | Pass | Pass |
| Physical device 1 |  |  |  | Pending | Pending | Pending | Pending |
| Physical device 2 |  |  |  | Pending | Pending | Pending | Pending |
