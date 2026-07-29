# SonTube TODO

## Phase 1 - MVP 골격

- [x] Next.js + TypeScript 프로젝트 구성
- [x] Prisma + SQLite 설정
- [x] Video/Tag/VideoTag 모델 생성
- [x] YouTube URL 파서 구현과 테스트
- [x] 관리자 영상 등록/수정/목록
- [x] 관리자 태그 관리와 추천 태그
- [x] 승인 영상만 표시하는 아이 화면
- [x] 태그/보호자 키워드 검색과 부모 최근 추천
- [x] 아이 로컬 플레이리스트와 YouTube iframe 재생
- [x] README 작성

## Phase 2 - 안정화

- [x] 관리자 로그인과 서버 액션 권한 검증
- [x] 관리자 메뉴별 첫 방문 슬라이드 가이드
- [x] 썸네일 업로드 삭제/교체 관리
- [x] 접근성 기초와 가이드 키보드 포커스 보강
- [x] 부모 관심 요약, 기간 필터, 아이 피드백
- [x] 통계 기반 외부 AI 분석 프롬프트 export
- [ ] 추천 태그 규칙 편집 UI
- [ ] Android/모바일 실제 기기 QA
- [ ] 접근성 스크린리더 세부 점검

## App Sync / Android Client

- [x] 관리자 앱 키 생성/조회/비활성화
- [x] 앱 키 해시 저장, 14일 체험, 설치 ID 바인딩
- [x] 최초 등록 API와 승인 카탈로그 JSON 동기화 API
- [x] 앱 키 등록, 하루 1회 자동 동기화, 수동 다시 불러오기
- [x] 아이 앱 광고 없음, 관리자 하단 광고/후원 슬롯
- [x] Android WebView 설치형 클라이언트 골격
- [x] 정확한 `/app` allowlist와 관리자/외부 URL/새 창 차단
- [x] URL 정책 순수 Java 스모크 테스트
- [x] Gradle Wrapper와 debug/release 서버 주소 분리
- [x] 탐색 기록 미복원, 뒤로가기 목적지와 History API 주소 재검사
- [x] 부모 설정 화면과 관리자 앱 키 가이드에 화면 고정 경로 표시
- [x] Android SDK로 debug APK 실제 빌드
- [ ] Android 실제 기기 영상 재생, 전체 화면과 외부 이동 차단 검증
- [ ] 화면 고정 또는 Lock Task 운영 방식 결정
- [ ] 앱 설정 부모 PIN/기기 인증 강화
- [ ] 서버 rate limit 영속 저장소 또는 edge middleware 검토

## 제품 후순위

- [ ] 아이별 프로필과 다중 아이 관심 통계
- [ ] 시청 시간 제한
- [ ] 시청 기록 범위 결정
- [ ] 웹 결제 entitlement 설계 확정
- [ ] 스토어 배포 전 결제/광고/연령 타겟 정책 검토
- [ ] iOS 제한형 클라이언트 검토
- [ ] AI API 직접 연동 여부 검토
