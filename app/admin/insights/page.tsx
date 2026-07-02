import Link from "next/link";
import { KidsInsightPromptCopy } from "@/components/admin/kids-insight-prompt-copy";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import {
  buildKidsInsightPrompt,
  getKidsInsightPeriod,
  summarizeKidsSignals,
  type CountedLabel,
  type CountedVideo,
  type KidsInsightRecord,
} from "@/lib/kids-insights";
import { getKidsSignalLabel, KIDS_SIGNAL_TYPES } from "@/lib/kids-signals";

export const dynamic = "force-dynamic";

type AdminKidsInsightsPageProps = {
  searchParams: Promise<{
    period?: string;
  }>;
};

const periodOptions = [
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
  { value: "all", label: "전체" },
];

export default async function AdminKidsInsightsPage({ searchParams }: AdminKidsInsightsPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const period = getKidsInsightPeriod(params.period);

  const signals = await prisma.kidsVideoSignal.findMany({
    where: period.since
      ? {
          updatedAt: { gte: period.since },
        }
      : undefined,
    include: {
      video: {
        include: {
          tags: {
            where: { tag: { isActive: true } },
            include: { tag: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const records: KidsInsightRecord[] = signals.map((signal) => ({
    type: signal.type,
    video: {
      id: signal.video.id,
      title: signal.video.title,
      searchKeywords: signal.video.searchKeywords,
      tags: signal.video.tags.map(({ tag }) => tag.name),
    },
  }));
  const summary = summarizeKidsSignals(records);
  const playlistSummary = summarizeKidsSignals(records.filter((record) => record.type === "PLAYLIST"));
  const prompt = buildKidsInsightPrompt(summary, { periodLabel: period.label });
  const signalStats = KIDS_SIGNAL_TYPES.map((type) => ({
    type,
    label: getKidsSignalLabel(type),
    count: summary.signalCounts[type] ?? 0,
  }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ocean">관심 요약</p>
          <h2 className="text-2xl font-bold text-ink">아이의 영상 반응</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            아이 화면에서 누른 반응과 내 목록 담기를 모아 보여줍니다. 영상은 보호자가 등록한 목록 안에서만 집계합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="관심 요약 기간">
          {periodOptions.map((option) => (
            <Link
              key={option.value}
              href={`/admin/insights?period=${option.value}`}
              aria-current={period.value === option.value ? "page" : undefined}
              className={`rounded-md border px-3 py-2 text-sm font-bold ${
                period.value === option.value
                  ? "border-ink bg-ink text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-ocean"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="전체 신호" value={summary.totalSignals} />
        <Metric label="관심 영상" value={summary.topVideos.length} />
        <Metric label="키워드" value={summary.topKeywords.length} />
        <Metric label="태그" value={summary.topTags.length} />
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-ink">반응 종류</h3>
        <div className="grid gap-2 md:grid-cols-4">
          {signalStats.map((item) => (
            <div key={item.type} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-600">{item.label}</p>
              <p className="mt-1 text-2xl font-black text-ink">{item.count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <RankedList title="관심이 모인 영상" items={summary.topVideos} emptyLabel="아직 반응이 없습니다." />
        <RankedList title="내 목록 영상" items={playlistSummary.topVideos} emptyLabel="아직 담긴 영상이 없습니다." />
        <RankedList title="자주 나온 키워드" items={summary.topKeywords} emptyLabel="키워드 신호가 없습니다." />
        <RankedList title="자주 나온 태그" items={summary.topTags} emptyLabel="태그 신호가 없습니다." />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <KidsInsightPromptCopy prompt={prompt} />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

function RankedList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<CountedVideo | CountedLabel>;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 grid gap-3">
          {items.map((item) => (
            <li key={"id" in item ? item.id : item.label} className="flex items-start justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-700">{"title" in item ? item.title : item.label}</span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
