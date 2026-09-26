# SonTube public contracts

이 폴더에는 웹 서버, 공개 Lite 뷰어, Android 클라이언트 사이에서 오래 유지해야 하는
JSON 경계를 기록합니다. 구현 코드와 함께 바뀌어야 하며 비밀키, 실제 앱 키, 가족 식별자,
계정 정보는 예제에 넣지 않습니다.

## Lite catalog v1

- 경로: `GET /api/lite/catalog`
- 인증: 없음
- 목적: 운영자가 명시적으로 Lite 공개한 영상만 읽기 전용으로 제공
- 성공 응답: `lite-catalog-v1.schema.json`
- 카탈로그 출처: `catalog.source = "LIVE"`
- 캐시 식별자: 요청마다 달라질 수 있는 `generatedAt`을 고려한 weak `ETag`와 `catalog.version`
- 성공 응답 캐시: 브라우저는 매번 재검증하고 공유 CDN은 최대 60초만 재사용
  (`Cache-Control: public, max-age=0, s-maxage=60, must-revalidate`)
- 오류 응답 캐시: `private, no-store`
- 공개 조건: `isLitePublished = true`, `isPublished = true`,
  `safetyStatus = PARENT_CHECKED`, 활성 `Family`
- 제외 정보: `familyId`, 원본 YouTube URL, 앱 키, 결제, 계정, 아이 반응

필드를 제거하거나 의미를 바꾸는 변경은 새 버전으로 추가합니다. 선택 필드를 더하는 호환
변경도 관련 클라이언트 검증을 통과한 뒤 반영합니다. Web CI는 이 스키마를 실제 Lite route의
200 응답에 적용하고 304 validator와 503 no-store 경계까지 함께 검사합니다.
