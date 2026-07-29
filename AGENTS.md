# AGENTS.md

## Project Identity

- Project: SonTube
- Root: `C:\codex\app\sontube`
- Repository: `https://github.com/seamoon23/sontube.git`
- Goal: 보호자가 직접 승인한 YouTube 영상만 아이가 제한형 앱에서 고르고 시청하는 가족용 영상서랍.

## Product Contract

SonTube는 아이에게 특정 취향을 강요하는 도구가 아니다. 집에서 보는 영상만큼은 보호자가 직접 검토한 목록 안에서 아이가 검색, 태그 필터, 재생목록과 짧은 피드백을 사용하며 편하게 고르도록 돕는다.

부모는 웹/모바일 브라우저의 관리자 화면을 사용하고, 아이는 주소창이 없는 설치형 Android 클라이언트를 사용한다.

## Never Implement

- YouTube Data API 또는 Google API Key
- YouTube 전체 검색
- 댓글 조회, 표시 또는 분석
- 자막 조회, 다운로드 또는 분석
- 채널 영상이나 플레이리스트 영상 자동 수집
- 자체 영상 업로드
- AI 태깅 API 또는 유료 AI 분석 API
- YouTube 광고 차단 또는 변조
- YouTube 영상 다운로드 또는 오프라인 저장
- 백그라운드 재생

## Allowed

- YouTube URL에서 videoId 파싱
- 등록된 영상의 YouTube iframe/embed 재생
- YouTube 기본 썸네일 URL 패턴
- 보호자가 작성한 제목, 설명, 영상 시간, 검색 키워드와 태그 저장
- 보호자가 업로드한 커스텀 썸네일 저장
- 내부 DB의 승인 영상만 검색, 필터링 및 앱 동기화
- 외부 API 비용이 없는 내부 통계와 복사용 분석 프롬프트

## Hard Rules

- 이 프로젝트 루트 밖의 파일은 수정하지 않는다.
- `C:\codex\app` 상위 폴더를 프로젝트 루트로 간주하지 않는다.
- 형제 프로젝트를 읽거나 수정하지 않는다. 필요한 경우 먼저 사용자에게 확인한다.
- 작업 전 현재 경로, Git 상태와 주요 파일 구조를 확인한다.
- 큰 변경 전에는 수정 대상 파일과 계획을 먼저 알린다.
- 비밀키, 앱 키 원문, 계정 정보와 개인정보를 코드나 문서에 저장하지 않는다.
- 잠금 파일은 실제 의존성 변경이 있을 때만 수정한다.
- 기존 사용자 변경을 되돌리지 않는다.
- 불필요한 리팩터링, 전체 포맷팅과 대규모 파일 이동을 피한다.

## UX Rules

- 아이 화면에는 관리자 기능, 주소창, YouTube 전체 검색, 댓글과 채널 이동 UI를 노출하지 않는다.
- 아이 기능은 직관성을 우선하며 복잡해지는 아이디어는 `docs/TODO.md`에 보류한다.
- 관리자 화면은 PC와 모바일 브라우저에서 모두 쉽게 등록하고 관리할 수 있어야 한다.
- 툴 명령이나 메뉴 사용법을 안내할 때는 시작 위치부터 접근 경로를 설명한다.

## Start Checklist

```powershell
pwd
git status
Get-ChildItem -Force
```

## Preferred Workflow

1. 현재 구조와 실행 방식을 요약한다.
2. 수정 대상 파일과 작업 계획을 공유한다.
3. 작은 단위로 구현한다.
4. 핵심 로직 테스트를 추가한다.
5. 타입, 린트, 테스트와 빌드를 검증한다.
6. 구현 결과, 남은 위험과 다음 작업을 요약한다.

## Commit Policy

- 사용자가 명시하기 전에는 커밋하거나 푸시하지 않는다.
- 커밋 전 `git diff --check`, 변경 요약과 테스트 결과를 확인한다.
- 비밀값과 로컬 빌드 산출물은 커밋하지 않는다.
- 커밋 메시지는 작업 의도가 드러나게 작성한다.

## Primary References

- 인수인계: `docs/codex-handover.md`
- 제품 정의: `docs/PRODUCT_BRIEF.md`
- 결정 기록: `docs/DECISIONS.md`
- 다음 작업: `docs/TODO.md`
- Android 실행: `android-client/README.md`
