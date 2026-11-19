# SonTube 1차 운영 Runbook

Updated: 2026-11-19

현행은 무료 가족 운영이다. `PAYMENT_*` 설정은 사전점검 필수가 아니며 `ADMIN_ALLOWED_EMAILS`는 선택적인 Lite 공개 운영자 두 계정만 지정한다. 일반 보호자는 활성 DB 계정과 가족으로 로그인한다. 기존 두 이메일 전용 Cloudflare Access 정책은 새 가족 초대 전에 재검토한다.

6번째 `20261119000000_free_family_limits` migration이 필요하다. 배포 시 쓰기를 중지하고 아래 절차로 DB·업로드 백업을 검증한 다음, 프로젝트 루트에서 `npm run db:migrate`를 실행하고 재시작한다. 한도와 동기화 변경 번호는 DB 트리거가 관리하므로 `db:push`로 대체하지 않는다. 기존 20개 초과 가족의 영상도 보존되며 필요하면 `최종관리자 로그인 > 사용자·가족 > 무료 영상 등록 한도`에서 조정한다.

이 문서는 영구 디스크가 있는 단일 Node 서버에서 현재 Next.js·SQLite·로컬 썸네일 구성을 운영하기 위한 절차다. Cloudflare Pages나 다중 인스턴스 운영 절차가 아니다.

백업 도구가 Node 내장 SQLite를 사용하므로 Node.js 22.5 이상이 필요하다. 현재 검증한 런타임은 Node.js 22.17.0이며, 운영 호스트도 Node 22 계열로 고정한다. 실행 시 표시되는 SQLite experimental 경고는 Node 22의 기능 상태 안내이며, 명령의 성공·실패는 종료 코드와 최종 JSON 결과로 판단한다.

## 1. 영구 데이터 경계

- `DATABASE_URL`은 영구 볼륨의 절대 SQLite `file:` 경로를 사용한다.
  - Linux 예: `file:/var/lib/sontube/sontube.db`
  - Windows 예: `file:C:/sontube-data/sontube.db`
- 배포 경로의 `public/uploads/thumbnails/`도 릴리스 교체 후 유지되는 영구 디스크에 둔다.
- `.env`와 호스팅 secrets는 백업 archive에 포함되지 않는다. 호스팅 제공자의 암호화된 secret 보관/내보내기 수단으로 별도 보관하고 같은 배포 revision을 기록한다.
- 백업 archive에는 가족 데이터와 썸네일이 들어 있으므로 공개 웹 폴더, Git 저장소, 일반 공유 드라이브에 두지 않는다.

## 2. 운영 환경 사전점검

PowerShell을 열고 SonTube 프로젝트 루트부터 시작한다.

```powershell
cd C:\codex\app\sontube
$env:NODE_ENV = "production"
npm run ops:preflight
```

검사는 실제 값을 출력하지 않고 다음 항목의 이름과 문제만 표시한다.

- 영구 볼륨의 절대 `DATABASE_URL`
- 서로 다른 32자 이상 보호자/최종관리자 세션 비밀키
- 서로 다른 운영 보호자 이메일 정확히 두 개
- 64자리 보호자/최종관리자 비밀번호 해시와 bootstrap 조합
- 최종관리자 ID와 사업자·계좌·문의 필수 항목

상대 DB 경로, 메모리 DB, `tmp`, `.next`, `node_modules` 아래 DB와 예제 placeholder가 남아 있으면 운영을 시작하지 않는다.

## 3. 배포와 재시작

호스트의 SonTube checkout에서 아래 순서로 진행한다. 새 릴리스 적용 전에는 5절에 따라 쓰기를 멈추고 백업을 먼저 만든다.

```powershell
cd C:\codex\app\sontube
npm ci
npm run verify:web
npm run db:migrate
$env:NODE_ENV = "production"
npm run ops:preflight
npm run build
npm run start
```

- `npm run db:seed`는 첫 bootstrap이나 명시적인 운영 데이터 보강 때만 실행한다. 일반 재배포마다 반복하지 않는다.
- `npm run start`는 `127.0.0.1:3000`에 바인딩된다. Cloudflare Tunnel 또는 같은 호스트의 reverse proxy가 이 origin으로 연결되게 한다.
- 프로세스 관리 도구를 사용한다면 위와 같은 환경값·작업 경로로 `npm run start`를 실행하고, restart 후 4절의 probe와 공개/보호 경계 smoke test를 반복한다.

## 4. 헬스체크

프로세스를 시작한 뒤 호스트 또는 모니터의 HTTP probe를 `GET /api/health`로 지정한다.

- DB 읽기 성공: `200 {"status":"ok"}`
- DB 읽기 실패: `503 {"status":"unavailable"}`
- GET과 HEAD 모두 `Cache-Control: no-store`

응답은 DB 경로, 버전, 계정이나 오류 원문을 노출하지 않는다. 이 경로는 생존/DB 읽기 검사일 뿐 로그인·Lite·Android 동기화 smoke test를 대신하지 않는다.

## 5. 백업

백업은 새 디렉터리에만 생성된다. SQLite는 `VACUUM INTO`로 스냅샷하고, 썸네일은 복사 전후 SHA-256이 같을 때만 manifest를 확정한다. 그래도 DB와 파일을 하나의 트랜잭션으로 잠글 수 없으므로 반드시 관리자 등록·결제 처리를 포함한 애플리케이션 쓰기를 먼저 멈춘다.

1. 호스팅 Dashboard에서 SonTube 인스턴스를 중지하거나 유지보수 상태로 전환한다. 로컬 `next start`라면 실행 중인 PowerShell에서 `Ctrl+C`를 누른다.
2. 프로젝트 루트의 새 PowerShell에서 백업한다. 출력 디렉터리는 아직 존재하지 않아야 한다.

```powershell
cd C:\codex\app\sontube
npm run ops:backup -- "D:\sontube-backups\2026-08-30-0100"
npm run ops:backup:verify -- "D:\sontube-backups\2026-08-30-0100"
```

3. `verify`가 성공한 archive를 서버 밖의 암호화된 저장소에 복사한다.
4. 앱을 다시 시작하고 `/api/health`, 부모 로그인, Lite 공개 목록과 Android 동기화를 확인한다.

manifest는 DB와 각 썸네일의 크기·SHA-256, 생성 시점과 쓰기 중지 경고를 담는다. 환경변수 원문은 기록하지 않는다.

## 6. 복구 훈련과 실제 복구

복구는 기본적으로 기존 DB·WAL·SHM·journal·썸네일 디렉터리를 덮어쓰지 않는다. `--force`는 애플리케이션을 완전히 멈추고 현재 데이터의 별도 사본을 확보한 뒤에만 사용한다.

```powershell
cd C:\codex\app\sontube
npm run ops:backup:verify -- "D:\sontube-backups\2026-08-30-0100"
npm run ops:restore:plan -- "D:\sontube-backups\2026-08-30-0100"
```

dry-run의 대상 경로와 덮어쓰기 여부를 확인한 뒤:

```powershell
npm run ops:restore:force -- "D:\sontube-backups\2026-08-30-0100"
npm run db:migrate
$env:NODE_ENV = "production"
npm run ops:preflight
```

도구는 새 파일을 staging한 뒤 기존 대상을 rollback 이름으로 이동하고 교체한다. 배치 중 실패하면 기존 대상을 되돌리며, 성공 후 rollback 사본 삭제가 실패하면 수동 삭제 경로를 경고한다.

앱을 다시 시작한 다음 아래를 확인한다.

1. `/api/health` 200
2. 두 운영 보호자 중 한 명의 로그인과 영상·채널 수
3. 커스텀 썸네일 표시
4. 최종관리자 결제/감사 화면 읽기
5. 테스트 Android 앱 키의 버전 확인과 승인 목록 동기화

## 7. 백업 운영 기준

- 초기에는 매일 1회와 배포·migration 직전마다 백업한다.
- 최소 최근 일간 7개와 주간 4개를 서로 다른 저장장치에 보관한다.
- 매월 하나를 격리된 staging 경로에 복구해 행 수, 썸네일과 주요 화면을 확인한다.
- archive 검증 성공만으로 복구 가능성을 단정하지 않고 실제 restore drill 결과와 날짜를 운영 기록에 남긴다.
- 다중 인스턴스나 서버리스로 전환하기 전에 SQLite와 프로세스 로컬 rate limit을 관리형 PostgreSQL·공유 limiter로 교체한다.
