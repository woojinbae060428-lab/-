import { useEffect, useState } from 'react';
import { Disc3, Search, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDateRange, isSafePosterUrl } from '../lib/format';
import type { GigItem } from '../types/band';
import { DbSetupNotice } from './DbSetupNotice';

type GigTab = 'upcoming' | 'festival';

interface GigsResponse {
  gigs: GigItem[];
  todayKst: string;
}

function GigPoster({ url, title }: { url: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const safeUrl = isSafePosterUrl(url) ? url : null;

  if (!safeUrl || failed) {
    return (
      <div
        className="flex h-24 w-18 shrink-0 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-400"
        aria-hidden="true"
      >
        <Disc3 className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={safeUrl}
      alt={`${title} 포스터`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-24 w-18 shrink-0 rounded-lg border border-zinc-200 bg-zinc-100 object-cover"
      loading="lazy"
    />
  );
}

export function GigsView() {
  const [activeTab, setActiveTab] = useState<GigTab>('upcoming');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [gigs, setGigs] = useState<GigItem[]>([]);
  const [todayKst, setTodayKst] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ tab: activeTab });
    if (debouncedQuery) {
      params.set('q', debouncedQuery);
    }

    apiFetch<GigsResponse>(`/api/gigs?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setGigs(res.gigs);
        setTodayKst(res.todayKst);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, debouncedQuery, reloadKey]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <section className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">공연 찾기</h1>
          <p className="mt-1 text-sm text-zinc-600">
            공연명이나 공연장 이름으로 검색하고 날짜순 일정을 확인하세요.
          </p>
        </div>

        {/* Interactive Tab Segmented Control */}
        <div
          role="tablist"
          aria-label="공연 목록 분류"
          className="inline-flex w-full rounded-xl bg-zinc-100 p-1 sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upcoming'}
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 sm:flex-initial min-h-[40px] rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'upcoming'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            다가오는 공연
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'festival'}
            onClick={() => setActiveTab('festival')}
            className={`flex-1 sm:flex-initial min-h-[40px] rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'festival'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            페스티벌
          </button>
        </div>
      </section>

      {/* Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="공연명 또는 공연장 검색 (예: 롤링홀, 펜타포트)"
            aria-label="공연명 또는 공연장 검색"
            className="h-11 w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="검색어 지우기"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="text-xs font-medium text-zinc-500 font-mono-tabular">
          {loading ? '검색 중...' : `총 ${gigs.length.toLocaleString('ko-KR')}건 · 날짜순`}
        </p>
      </div>

      {/* Content */}
      {error ? (
        <DbSetupNotice error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="h-24 w-18 shrink-0 animate-pulse rounded-lg bg-zinc-200" />
              <div className="flex-1 space-y-2.5 py-1">
                <div className="h-3.5 w-40 animate-pulse rounded bg-zinc-200" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-zinc-200" />
                <div className="h-3.5 w-1/2 animate-pulse rounded bg-zinc-200" />
              </div>
            </div>
          ))}
        </div>
      ) : gigs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-zinc-900">조건에 맞는 공연을 찾지 못했어요</p>
          <p className="mt-1.5 text-xs text-zinc-500">
            다른 검색어로 입력하거나 탭을 바꿔서 확인해 보세요.
          </p>
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
            >
              검색 초기화
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {gigs.map((gig) => {
            const isPast = todayKst && String(gig.gig_date).slice(0, 10) < todayKst;
            return (
              <article
                key={gig.gig_id}
                className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
              >
                <GigPoster url={gig.poster_url} title={gig.gig_title} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                    <span className="font-mono-tabular font-medium text-zinc-700">
                      {formatDateRange(gig.gig_date, gig.end_date)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={gig.gig_type === '페스티벌' ? 'font-medium text-rose-700' : ''}>
                      {gig.gig_type}
                    </span>
                    {isPast && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>지난 공연</span>
                      </>
                    )}
                  </div>

                  <h2 className="mt-1.5 text-base font-semibold leading-snug text-zinc-900 line-clamp-2">
                    {gig.gig_title}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-600 truncate">{gig.venue_name}</p>

                  {gig.bands && gig.bands.length > 0 && (
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500 line-clamp-1">
                      출연: {gig.bands.join(' · ')}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
