export function DevicePinningNotice() {
  return (
    <section className="grid gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-slate-700">
      <div>
        <p className="text-xs font-black text-ocean">부모님 기기 설정</p>
        <h2 className="mt-1 text-lg font-black text-ink">화면 고정을 함께 켜 주세요</h2>
      </div>
      <p>
        SonTube 앱은 외부 웹 주소를 차단합니다. Android 홈 화면과 다른 앱으로 나가는 동작까지 줄이려면 기기의 화면 고정을 함께 사용해야 합니다.
      </p>
      <p className="font-semibold text-ink">
        설정 &gt; 보안 또는 보안 및 개인정보 보호 &gt; 기타 보안 설정 &gt; 앱 고정
      </p>
      <p className="text-xs text-slate-600">
        제조사에 따라 메뉴 이름이 다를 수 있습니다. 완전한 전용 단말 잠금은 별도의 관리 기기 설정이 필요합니다.
      </p>
    </section>
  );
}
