# SonTube Product Brief

## 제품 정의

SonTube는 보호자가 직접 고른 YouTube 영상만 아이가 검색하고 볼 수 있게 하는 안전한 영상서랍이다.

## 핵심 문제

YouTube와 YouTube Kids에는 좋은 영상도 많지만 전체 검색, 자동 추천, 댓글, 채널 이동 과정에서 보호자가 의도하지 않은 영상이나 정보가 노출될 수 있다.

SonTube는 집 안에서 보는 영상만큼은 보호자가 미리 검토한 목록으로 제한하고, 아이가 그 안에서 자유롭게 고르는 작은 공간을 제공한다.

## MVP 사용자

- 보호자: 영상 URL, 제목, 설명, 영상 시간, 태그, 썸네일, 공개 여부를 직접 관리한다.
- 아이: 승인된 영상 목록 안에서 제목 검색과 태그 필터로 보고 싶은 영상을 고른다.
- 공개 방문자: 부모용 소개를 읽고, 운영자가 명시 공개한 공용 Lite 목록만 로그인 없이 체험한다.

## MVP 범위

- 관리자 영상 등록, 수정, 목록
- 태그 생성, 수정, 활성/비활성 관리
- 내부 데이터 기반 추천 태그
- YouTube 기본 썸네일, 커스텀 썸네일, placeholder fallback
- 아이 화면 승인 영상 목록, 제목/보호자 키워드 검색, 태그 필터, iframe 재생
- 부모가 직접 체크한 최근 추천 섹션
- 아이 브라우저 안에서 쓰는 간단한 내 목록
- 아이가 영상에 남기는 직관적 피드백 버튼
- 부모가 확인하는 관심 요약과 내 목록 영상 요약
- 최근 7일, 최근 30일, 전체 기준 관심 요약 필터
- 통계 기반 AI 분석용 복사 프롬프트 export
- 부모용 공개 소개와 별도 Lite 공개 표시가 있는 읽기 전용 공용 체험

## 제외 범위

- YouTube Data API
- Google API Key
- YouTube 전체 검색
- 댓글/자막 조회와 분석
- 채널/플레이리스트 자동 가져오기
- 자체 영상 업로드
- AI 태깅 API
- 광고 차단/변조
- 다운로드/오프라인 저장
- 백그라운드 재생

## 보류 아이디어

- 아이별 다중 프로필
- 기간별 관심 변화 차트
- AI API 직접 연동 분석
- 정교한 리포트 PDF/CSV export

## 2026-07-24 App Direction Update

- Target buyer/user for account management is the parent.
- Child-facing app mode is a restricted viewing client, not a general browser entry point.
- The approved catalog is shared through app-key authenticated JSON sync.
- The app checks its catalog version on launch and foreground return, and receives the full approved list only when it changed. There is no manual refresh button.
- The child-facing app has no ads; admin web can host a bottom ad/sponsor slot.
- Trial length is 14 days from app key creation.
- Initial payment is a prepaid business-account transfer with manual superadmin confirmation; card, in-app and automatic renewal are not included.

## 2026-08-30 Public Web And Hosting Update

- `/` is a parent-facing public brochure.
- `/lite` is a public read-only common catalog, not the family-specific restricted child app.
- A Lite video must be explicitly published to Lite and also remain parent-checked and published for children.
- Lite provides local catalog search/filtering, playback, full screen and a browser-local playlist only.
- Lite does not provide app keys, family data, payment, server feedback, device pinning or Wi-Fi enforcement.
- `/admin` is limited to two configured operating-parent emails; `/superadmin` remains owner-only.
- Web and Android stay in one repository while web deployment and Android artifacts use independent pipelines.
- The current dynamic Next.js, SQLite and local-upload system requires a persistent Node host. A static Cloudflare Pages deployment follows only after a separate SonTube Supabase migration and static web conversion.
