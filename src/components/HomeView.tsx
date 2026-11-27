import { ArrowRight, Calendar, Disc3, MapPin, Ticket } from 'lucide-react';
import type { HomeData, ScreenTab } from '../types/band';
import { formatCount, formatRatio } from '../lib/format';
import { DbSetupNotice } from './DbSetupNotice';

interface HomeViewProps {
  data: HomeData | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onNavigate: (tab: ScreenTab) => void;
  onOpenLogComposer: () => void;
}

export function HomeView({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
  onOpenLogComposer,
}: HomeViewProps) {
  if (error) {
    return <DbSetupNotice error={error} onRetry={onRetry} />;
  }

  if (loading || !data) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="홈 통계를 불러오는 중">
        <div className="space-y-3">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded-lg bg-zinc-200" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-white p-5" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-white p-6" />
      </div>
    );
  }

  const { kpi, weekdays } = data;
  const maxWeekdayCount = Math.max(1, ...weekdays.map((item) => Number(item.공연수) || 0));
  const peakDay = weekdays.reduce(
    (best, cur) => (Number(cur.공연수) > Number(best.공연수) ? cur : best),
    weekdays[0] ?? { 요일번호: 0, 요일: '', 공연수: 0 }
  );

  const kpiCards = [
    {
      label: '전체 공연',
      value: formatCount(kpi.전체_공연수),
      unit: '건',
      hint: '누적 등록 공연',
    },
    {
      label: '공연장',
      value: formatCount(kpi.공연장수),
      unit: '곳',
      hint: '라이브 홀 · 페스티벌',
    },
    {
      label: '다가오는 공연',
      value: formatCount(kpi.다가오는_공연수),
      unit: '건',
      hint: '오늘 이후 예정',
      accent: true,
    },
    {
      label: '단독 공연 비율',
      value: formatRatio(kpi.단독_비율),
      unit: '',
      hint: '페스티벌 제외 비중',
    },
  ];

  return (
    <div className="space-y-10">
      {/* Hero header */}
      <section className="flex flex-col gap-6 border-b border-zinc-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-rose-700">
            서울 인디 · 밴드 라이브 아카이브
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl text-balance">
            이번 주 라이브 일정부터 내 직관 기록까지 한눈에
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-600 sm:text-base">
            공연장별 일정 흐름을 확인하고, 놓치고 싶지 않은 밴드 공연과 다녀온 라이브의 한 줄 기억을 차곡차곡 남겨 보세요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('gigs')}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 whitespace-nowrap"
          >
            <Calendar className="h-4 w-4 text-zinc-600" />
            공연 찾아보기
          </button>
          <button
            type="button"
            onClick={onOpenLogComposer}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-800 whitespace-nowrap"
          >
            <Ticket className="h-4 w-4" />
            지난 공연 기록하기
          </button>
        </div>
      </section>

      {/* v_kpi 4 KPI Cards */}
      <section aria-labelledby="kpi-section-title">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="kpi-section-title" className="text-base font-semibold text-zinc-900">
            공연 데이터 요약
          </h2>
          <span className="text-xs text-zinc-500">기준일 {data.todayKst}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300"
            >
              <p className="text-xs font-medium text-zinc-500">{card.label}</p>
              <div className="mt-2.5 flex items-baseline gap-1">
                <span
                  className={`font-mono-tabular text-2xl font-semibold tracking-tight sm:text-3xl ${
                    card.accent ? 'text-rose-700' : 'text-zinc-900'
                  }`}
                >
                  {card.value}
                </span>
                {card.unit && (
                  <span className="text-sm font-medium text-zinc-500">{card.unit}</span>
                )}
              </div>
              <p className="mt-2 text-xs text-zinc-500">{card.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* v_weekday Bar Chart */}
      <section
        aria-labelledby="weekday-section-title"
        className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="weekday-section-title" className="text-base font-semibold text-zinc-900">
              요일별 공연 수
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {weekdays.length > 0 && Number(peakDay.공연수) > 0
                ? `${peakDay.요일}요일에 ${formatCount(peakDay.공연수)}건으로 가장 많은 공연이 열립니다.`
                : '요일별 등록 공연 분포입니다.'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-700" aria-hidden="true" />
              최다 요일
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-800" aria-hidden="true" />
              기타 요일
            </span>
          </div>
        </div>

        {weekdays.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-500">
            표시할 요일별 통계가 아직 없어요.
          </div>
        ) : (
          <div className="mt-8">
            <div className="grid grid-cols-7 items-end gap-2 sm:gap-4 h-52 sm:h-60 border-b border-zinc-200 pb-3">
              {weekdays.map((item) => {
                const count = Number(item.공연수) || 0;
                const heightPct = Math.max(6, Math.round((count / maxWeekdayCount) * 100));
                const isPeak = count > 0 && count === Number(peakDay.공연수);

                return (
                  <div
                    key={item.요일번호}
                    className="flex h-full flex-col items-center justify-end gap-2"
                  >
                    <span className="font-mono-tabular text-xs font-medium text-zinc-700">
                      {formatCount(count)}
                    </span>
                    <div className="flex w-full max-w-[44px] flex-1 items-end justify-center">
                      <div
                        role="img"
                        aria-label={`${item.요일}요일 공연 ${count}건`}
                        title={`${item.요일}요일: ${count}건`}
                        className={`w-full rounded-t-lg transition-opacity ${
                          isPeak ? 'bg-rose-700' : 'bg-zinc-800'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-7 gap-2 sm:gap-4 text-center">
              {weekdays.map((item) => {
                const count = Number(item.공연수) || 0;
                const isPeak = count > 0 && count === Number(peakDay.공연수);
                return (
                  <span
                    key={item.요일번호}
                    className={`text-xs sm:text-sm font-medium ${
                      isPeak ? 'text-rose-700 font-semibold' : 'text-zinc-600'
                    }`}
                  >
                    {item.요일}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Quick jump shortcuts */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate('venues')}
          className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-zinc-300"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">인기 공연장 도장깨기 TOP 15</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                공연이 가장 많이 열리는 15곳 중 내가 가 본 공연장과 아직 못 가 본 곳을 확인해 보세요.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('log')}
          className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-zinc-300"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <Disc3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">내 직관 기록장 & 팔로우 일정</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                팔로우한 밴드의 다가오는 공연 소식을 보고, 지난 공연의 한 줄 메모를 남겨 보세요.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700" />
        </button>
      </section>
    </div>
  );
}
