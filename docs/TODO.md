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
- [x] 타입·린트·테스트·빈 DB migration·프로덕션 빌드 통합 검증과 Web CI
- [x] Android 정책 순수 Java 통합 명령과 별도 CI
- [x] 기본 웹 보안 응답 헤더 적용
- [x] 관리자·아이·보호 API 경로 robots 차단과 no-store 응답(Lite 공개 API 예외)
- [ ] 추천 태그 규칙 편집 UI
- [ ] Android/모바일 실제 기기 QA
- [ ] 접근성 스크린리더 세부 점검

## Channel Grouping

- [x] 가족별 `Channel` 마스터와 선택적 `Video.channelId` 연결
- [x] 영상 등록·수정 시 기존 채널 선택 또는 새 채널명 직접 입력
- [x] 관리자 채널 목록(`/admin/channels`)과 영상 목록 채널 필터
- [x] 앱 카탈로그의 nullable 채널 정보와 같은 채널 승인·공개 영상 로컬 필터
- [x] 기존 영상의 채널 미지정 호환 migration
- [x] 외부 채널 이동·자동 수집·YouTube API 없이 내부 승인 목록으로 제한
- [x] 채널 이름 변경·비활성화·중복 채널 병합 관리

## Public Web / Lite / Deployment

- [x] 웹과 Android 단일 저장소 유지, 웹 배포와 Android 산출물 CI 분리 원칙 확정
- [x] 공개 `/` 부모용 브로슈어, `/lite` 읽기 전용 공용 체험 경계 확정
- [x] `Video.isLitePublished`·`liteSortOrder`와 안전 조건 기반 `GET /api/lite/catalog` 추가
- [x] `/`에서 관리자·아이 QA 화면 직접 진입을 제거하고 부모용 소개·Lite·설치형 앱 안내로 교체
- [x] `/lite` 공개 목록 UI, 빈·오류 상태, 검색·태그·채널 필터와 로컬 내 목록 구현 및 모바일 레이아웃 검증
- [x] 실제 모바일 브라우저 뷰포트에서 Lite YouTube 재생·전체 화면 확장/닫기 회귀 QA
- [ ] Lite를 실제 iOS/Android 일반 브라우저와 설치형 PWA에서 교차 검증
- [x] `/lite`와 `/api/lite/*`의 초기 `noindex`, robots crawl 허용 및 상태별 공개 캐시 헤더 검증
- [x] 관리자 영상 등록·수정의 명시적 Lite 공개 제어와 안전 조건 validation, 목록 배지 검증
- [x] Lite JSON Schema와 실제 200/304/503 route 응답·weak ETag 계약 자동 검증
- [x] `ADMIN_ALLOWED_EMAILS` 애플리케이션 allowlist 적용
- [x] 비밀번호/계정/가족 상태 변경 시 보호자 세션 버전 폐기와 대체 로그인 읽기 전용 강제
- [ ] 운영 환경에 관리자 이메일 정확히 두 개를 등록하고 두 계정 모두 로그인·세션 차단 회귀 테스트
- [ ] 일반 보호자 계정을 두 운영자 밖으로 개방하기 전에 Lite 공개 전용 역할과 변경 감사 로그 분리
- [ ] Cloudflare Access에 `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*`, `/kids`, `/kids/*` 두 계정 정책 적용
- [ ] Cloudflare Access에 `/superadmin`, `/superadmin/*` 소유자 한 명 정책 적용
- [ ] 공개 `/`, `/lite`, `/api/lite/*`, `/app`, `/api/app/*`가 Access 로그인 없이 열리는지 확인
- [x] SQLite·업로드 동시 백업/검증/복구 CLI와 운영 환경 사전점검·DB 헬스체크 준비
- [ ] 선택한 영구 디스크 Node 호스트에서 실제 백업 보관·복구 훈련
- [x] 웹 CI와 Android 로직/debug APK CI를 독립 경로로 구성
- [ ] Android release signing APK/AAB CI와 수동 승인 배포 구성
- [ ] SonTube 전용 Supabase PostgreSQL·Auth·RLS·Storage·Edge Function 이관 설계 및 RLS 격리 테스트
- [ ] 정적 SPA/PWA 재구성 후 SonTube 전용 Cloudflare Pages 프로젝트로 전환

## App Sync / Android Client

- [x] 관리자 앱 키 생성/조회/비활성화
- [x] 앱 키 해시 저장, 14일 체험, 설치 ID 바인딩
- [x] 최초 등록 API와 승인 카탈로그 JSON 동기화 API
- [x] 앱 키 등록과 정상 승인 뒤에만 기존 키/캐시 교체
- [x] 앱 시작·복귀마다 카탈로그 버전 확인, 변경 시에만 승인 목록 수신
- [x] 수동 다시 불러오기 제거
- [x] 아이 앱 광고 없음, 관리자 하단 광고/후원 슬롯
- [x] Android WebView 설치형 클라이언트 골격
- [x] 정확한 `/app` allowlist와 관리자/외부 URL/새 창 차단
- [x] URL 정책 순수 Java 스모크 테스트
- [x] Gradle Wrapper와 debug/release 서버 주소 분리
- [x] 탐색 기록 미복원, 뒤로가기 목적지와 History API 주소 재검사
- [x] 부모 설정 화면과 관리자 앱 키 가이드에 화면 고정 경로 표시
- [x] Android SDK로 debug APK 실제 빌드
- [x] Android API 32 에뮬레이터 앱 키/동기화/재생/전체 화면/이탈 차단 QA
- [x] 네트워크 오류 네이티브 재시도 화면과 복구 검증
- [x] 관리자 Wi-Fi 필수 정책과 통신 실패 시 기본값 true 처리
- [x] 연결 불가 시 재생 없는 샘플 카드 10개, 검색/태그 필터 화면
- [x] 아이 화면 무료 체험 상태 카드 제거
- [x] 앱 표시 중 네트워크 변경 즉시 차단과 서버 통신 정책 재확인
- [x] 로그인·앱 동기화·결제 요청의 메모리 상한형 프로세스 로컬 rate limit
- [x] Android 앱 데이터 백업·기기 이전 차단과 기본 런처 아이콘
- [x] Android lint 오류 0 상태와 debug APK 재빌드
- [ ] Android 실제 기기 영상 재생, 전체 화면과 외부 이동 차단 검증
- [ ] 화면 고정 또는 Lock Task 운영 방식 결정
- [x] Android 기기 자격 증명 우선 부모 인증 설계
- [ ] 앱 설정 부모 PIN/기기 인증 강화
- [ ] 서버 rate limit 영속 저장소 또는 edge middleware 검토

## 제품 후순위

- [ ] 아이별 프로필과 다중 아이 관심 통계
- [ ] 시청 시간 제한
- [ ] 시청 기록 범위 결정
- [x] 계좌이체 수동 승인 결제와 가족별 entitlement 구현
- [ ] 스토어 배포 전 결제/광고/연령 타겟 정책 검토
- [ ] iOS 제한형 클라이언트 검토
- [ ] AI API 직접 연동 여부 검토

## Manual Payment / Superadmin

- [x] Family·ParentUser 기반 보호자 로그인과 기존 데이터 귀속
- [x] 가족별 영상·태그·앱 키·아이 반응·통신정책 격리
- [x] 3개월·1년 상품과 서버 가격 스냅샷 결제 신청
- [x] 사업자·계좌 안내 환경변수와 부모 결제 내역 화면
- [x] 최종관리자 전용 인증과 가족·보호자·상품 관리
- [x] 입금 승인·거절·만료와 멱등 이용권 생성·연장
- [x] 전액 환불 요청·반려·완료와 최신 지급 건 회수
- [x] 결제·이용권·대체로그인 감사 로그
- [x] 체크인 가능한 Prisma migration과 bootstrap seed
- [ ] 공개 판매 전 사업자·통신판매·환불·현금영수증 정책 최종 확인
- [ ] 최종관리자 2단계 인증과 영속 로그인 rate limit
- [ ] 현금영수증 전용 암호화 저장·마스킹·보존 정책
- [ ] 부분 환불과 기간 비례 정산 정책
- [ ] 결제·환불 CSV 대사 내보내기
- [x] SQLite 단일 인스턴스는 1차 운영까지만 사용하고 관리형 DB 전환 기준 확정
- [ ] 테마샵은 실제 유료 이용자 반응 확인 후 상품·IP·환불 정책과 함께 별도 설계
