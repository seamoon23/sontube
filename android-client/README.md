# SonTube Android Client

이 폴더는 아이가 일반 브라우저를 열지 않고 SonTube의 승인 영상 화면만 사용하도록 만든 Android 전용 클라이언트입니다.

## 현재 동작

- 주소창과 일반 브라우저 UI가 없는 Android WebView로 `/app`을 표시합니다.
- 설정한 서버의 정확한 scheme, host, port와 `/app` 경로만 최상위 화면으로 허용합니다.
- `/admin`, `/kids`, 외부 YouTube 페이지, 검색 사이트, 사용자 정보가 든 URL과 custom scheme 이동을 차단합니다.
- 새 창, 파일 다운로드, 파일 시스템 접근, 앱 권한 요청과 길게 누르기를 차단합니다.
- 앱을 다시 열 때 WebView 탐색 기록을 복원하지 않으며 History API로 바뀐 주소도 다시 검사합니다.
- YouTube iframe 전체 화면 재생은 지원하고, 강제 화면 회전으로 Activity가 다시 만들어지는 동작은 피합니다.
- 시작할 때 `/api/app/policy`를 먼저 확인하고, 정책 확인 실패 또는 Wi-Fi 필수 상태의 비 Wi-Fi 연결에서는 실제 목록 대신 로컬 샘플 화면을 표시합니다.
- 설치 ID를 Android 전용 저장소에 고정하고 해당 설치에 등록된 가족의 Wi-Fi 정책과 승인 목록만 조회합니다.
- 앱은 시작과 전면 복귀 때마다 카탈로그 버전을 확인하고 버전이 바뀐 경우에만 새 승인 목록을 받습니다.
- 내부 검색, 태그, 재생목록과 피드백은 서버의 `/app` 기능을 사용하며 수동 다시 불러오기 버튼은 두지 않습니다.
- 새 앱 키는 서버가 정상 승인한 뒤에만 기존 키와 캐시를 교체합니다.
- 앱 키와 설치 ID가 다른 백업이나 기기로 복원되지 않도록 cloud backup과 기기 이전을 제외합니다.

## 중요한 보안 경계

앱은 최상위 화면이 외부 웹사이트로 이동하는 것을 막습니다. 일반 Android 앱만으로 홈 버튼과 다른 앱 실행까지 완전히 잠글 수는 없습니다.

아이 기기에서는 `설정 > 보안 또는 보안 및 개인정보 보호 > 기타 보안 설정 > 앱 고정`에서 화면 고정을 함께 사용하세요. 제조사에 따라 메뉴 이름은 다를 수 있습니다. 완전한 키오스크는 기기 소유자 또는 DPC가 허용한 Android Lock Task 구성이 필요합니다.

YouTube 재생은 YouTube가 제공하는 iframe입니다. 같은 영상을 반복 재생하도록 설정해 종료 추천 노출을 줄이고 iframe의 최상위 이동을 차단하지만, 플레이어 내부 광고와 YouTube가 표시하는 요소를 SonTube가 제거하거나 완전히 통제할 수는 없습니다.

현재 런처 아이콘은 배포 누락을 막기 위한 코드형 기본 아이콘입니다. 스토어 공개 전에 최종 브랜드 아이콘으로 교체해야 합니다.

## 부모 통신 정책

부모 관리자 브라우저에서 `관리자 화면 > 대시보드 > 앱 접속 정책`으로 이동합니다. `Wi-Fi 연결 필수`를 켜면 Android 앱은 Wi-Fi에서만 승인 목록을 확인하고, 끄면 모바일 데이터도 허용합니다. 정책 API에 닿지 못하면 기본값은 `true`이며 실제 승인 목록과 YouTube 플레이어 대신 재생되지 않는 샘플 카드만 표시합니다.
## Android Studio에서 실행

1. PC의 `C:\codex\app\sontube`에서 `npm run dev:lan`을 실행합니다.
2. Android Studio에서 `File > Open`으로 이동합니다.
3. `C:\codex\app\sontube\android-client` 폴더를 선택합니다.
4. `File > Settings > Build, Execution, Deployment > Build Tools > Gradle`에서 Gradle JDK가 17인지 확인합니다.
5. 상단 기기 선택 메뉴에서 에뮬레이터 또는 연결한 Android 기기를 고릅니다.
6. `Run > Run 'app'`을 선택합니다.

이 프로젝트는 Android API 36, Android Gradle Plugin 8.13.2, Gradle 8.13, JDK 17 기준입니다.

상세 실행 경로, 에뮬레이터 검증 결과와 실제 기기 기록표는 `docs/ANDROID_QA_CHECKLIST.md`를 사용하세요.

### 접근성·작은 화면 확인

실제 기기에서는 먼저 `설정 > 접근성 > TalkBack`으로 이동해 화면 읽기를 켠 뒤 SonTube를 실행합니다. 제조사에 따라 `설정 > 접근성 > 설치된 앱 > TalkBack` 경로를 사용할 수 있습니다.

- 네트워크를 끊어 샘플 화면을 열고 `연결 전 샘플 화면`, 안내 문구, 샘플 제목, `연결 다시 확인` 순서로 자연스럽게 읽히는지 확인합니다.
- `연결 다시 확인` 버튼이 글자 크기 확대 상태에서도 잘리지 않고 한 번에 눌리는지 확인합니다.
- `설정 > 접근성 > 시인성 향상 또는 글자 크기와 스타일`에서 글자 크기를 크게 한 뒤 샘플 여섯 개와 재시도 버튼까지 세로 스크롤할 수 있는지 확인합니다.
- `설정 > 접근성 > 시인성 향상 또는 애니메이션 삭제`를 켜고 WebView 화면의 전환 효과가 최소화되는지 확인합니다. 메뉴 이름은 Android 버전과 제조사에 따라 다를 수 있습니다.

확인이 끝나면 TalkBack을 끄고 `docs/ANDROID_QA_CHECKLIST.md > Physical-device record`에 기기명, Android 버전과 결과를 기록합니다.

## 서버 주소

`android-client/gradle.properties`에서 로컬 디버그 주소를 설정합니다.

- Android 에뮬레이터: `SONTUBE_DEBUG_APP_URL=http://10.0.2.2:3000/app`
- 실제 기기 로컬 테스트: `SONTUBE_DEBUG_APP_URL=http://<PC의-LAN-IP>:3000/app`
- 배포용 릴리스: `SONTUBE_RELEASE_APP_URL=https://<운영-도메인>/app`

실제 기기 로컬 테스트에서는 PC와 기기를 같은 Wi-Fi에 연결하고 SonTube를 `npm run dev:lan`으로 실행해야 합니다. 릴리스 빌드는 정확한 HTTPS `/app` 주소가 없으면 빌드 검증 단계에서 실패합니다.

## Gradle Wrapper와 APK

PowerShell에서 다음 경로로 이동해 디버그 APK를 만들 수 있습니다.

```powershell
cd C:\codex\app\sontube\android-client
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug
```

생성 위치는 `android-client\app\build\outputs\apk\debug\app-debug.apk`입니다. Android Studio에서는 `Build > Build Bundle(s) / APK(s) > Build APK(s)`로 같은 작업을 실행할 수 있습니다.

릴리스 주소 검증은 다음처럼 실행합니다.

```powershell
.\gradlew.bat assembleRelease -PSONTUBE_RELEASE_APP_URL=https://family.example.com/app
```

실제 배포 전에는 앱 서명, 최종 브랜드 아이콘, 개인정보 처리방침, 결제 정책과 실제 기기 검증이 추가로 필요합니다.

## Android 정책 테스트

Android SDK 없이 JDK 17만으로 URL, WebView 오류 상태, 시작 통신 정책과 실행 중 네트워크 전환 테스트를 모두 실행할 수 있습니다. PowerShell에서 프로젝트 루트로 이동한 뒤 실행합니다.

```powershell
cd C:\codex\app\sontube
npm run verify:android:logic
```

명령은 임시 컴파일 폴더를 성공·실패와 관계없이 정리합니다. 같은 검증은 `.github\workflows\android-logic-ci.yml`에서도 실행됩니다.
