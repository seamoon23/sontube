# SonTube Project Brief

## Product

SonTube는 보호자가 직접 승인한 YouTube 영상만 아이가 제한형 앱에서 검색하고 시청하도록 돕는 가족용 영상서랍이다.

## Users And Surfaces

- 보호자: PC 또는 모바일 브라우저의 `/admin`
- 아이: `android-client/`로 빌드한 주소창 없는 Android 앱
- 앱 콘텐츠 화면: 서버의 `/app`

## Product Principles

- 보호자가 승인하고 공개한 내부 영상만 카탈로그에 포함한다.
- 아이에게 YouTube 전체 검색, 댓글, 채널 이동과 관리자 기능을 제공하지 않는다.
- YouTube Data API, Google API Key와 유료 AI API를 사용하지 않는다.
- 아이 앱에는 광고를 넣지 않는다.
- 아이의 피드백은 감시가 아니라 관심사를 이해하기 위한 짧고 직관적인 신호로 취급한다.

## Current MVP

- 영상, 태그, 썸네일, 안전 상태와 부모 추천 관리
- 내부 키워드와 기존 영상 태그를 이용한 추천 태그
- 관리자 로그인과 메뉴별 슬라이드 가이드
- 아이 내부 검색, 태그 필터, 부모 최근 추천과 핫태그
- 아이 로컬 재생목록과 짧은 영상 피드백
- 부모 관심 요약과 외부 AI 도구용 복사 프롬프트
- 앱 키 등록, 설치 ID 바인딩, 14일 체험과 24시간 카탈로그 동기화
- 외부 최상위 URL을 차단하는 Android WebView 클라이언트

## Immediate Priorities

1. Android 실제 기기에서 재생, 전체 화면, 네트워크 오류와 외부 이동 차단 검증
2. 일반 화면 고정과 관리형 기기 Lock Task 중 운영 방식 결정
3. 앱 설정의 부모 PIN 또는 Android 기기 인증 보강
4. 서버 rate limit의 영속 저장소 또는 배포 환경 middleware 검토
5. 웹 결제 entitlement와 스토어 정책 검토

상세 상태와 다음 대화 프롬프트는 `docs/codex-handover.md`를 기준으로 한다.
