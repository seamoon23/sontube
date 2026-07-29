export function AdminAdSlot() {
  return (
    <aside id="admin-ad" className="border-t border-slate-200 bg-white px-4 py-4 md:px-8" aria-label="관리자 광고 및 공지">
      <div className="mx-auto grid max-w-6xl gap-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:grid-cols-[auto_1fr] md:items-center md:gap-3">
        <strong className="text-slate-800">광고/후원 영역</strong>
        <span>
          관리자 화면에만 표시되는 기본 노출 영역입니다. 아이 앱에는 광고를 넣지 않으며, YouTube 플레이어 자체 광고는 YouTube 정책에 따라 노출될 수 있습니다.
        </span>
      </div>
    </aside>
  );
}
