import { useEffect, useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatCount } from '../lib/format';
import type { UserItem, VenueVisitItem } from '../types/band';
import { DbSetupNotice } from './DbSetupNotice';

interface VenuesResponse {
  nickname: string;
  venues: VenueVisitItem[];
}

type VisitFilter = 'all' | 'visited' | 'unvisited';

interface VenuesViewProps {
  users: UserItem[];
  selectedUserId: number | null;
  onSelectUserId: (id: number) => void;
}

export function VenuesView({ users, selectedUserId, onSelectUserId }: VenuesViewProps) {
  const selectedUser = users.find((u) => u.user_id === selectedUserId) ?? users[0] ?? null;
  const [venues, setVenues] = useState<VenueVisitItem[]>([]);
  const [filter, setFilter] = useState<VisitFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!selectedUser && users.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const nickname = selectedUser?.nickname ?? '';
    const query = nickname ? `?nickname=${encodeURIComponent(nickname)}` : '';

    apiFetch<VenuesResponse>(`/api/venues${query}`)
      .then((res) => {
        if (cancelled) return;
        setVenues(res.venues);
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
  }, [selectedUser?.nickname, users.length, reloadKey]);

  const maxGigCount = Math.max(1, ...venues.map((v) => Number(v.공연수) || 0));
  const visitedCount = venues.filter((v) => Number(v.간_횟수) > 0).length;

  const filteredVenues = venues.filter((v) => {
    const visits = Number(v.간_횟수) || 0;
    if (filter === 'visited') return visits > 0;
    if (filter === 'unvisited') return visits === 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header + Member selector */}
      <section className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">공연장 TOP 15</h1>
          <p className="mt-1 text-sm text-zinc-600">
            공연이 많이 열리는 상위 15곳 중 내가 가 본 공연장과 아직 가 보지 않은 공연장을 구분해 보여줘요.
          </p>
        </div>

        {users.length > 0 && (
          <div className="flex items-center gap-2.5 shrink-0">
            <label htmlFor="venue-user-select" className="text-xs font-medium text-zinc-500 whitespace-nowrap">
              기준 회원
            </label>
            <select
              id="venue-user-select"
              value={selectedUser?.user_id ?? ''}
              onChange={(e) => onSelectUserId(Number(e.target.value))}
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none"
            >
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.nickname}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* Summary & Legend + Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-zinc-700">
          <span className="font-semibold text-zinc-900 font-mono-tabular">
            TOP {venues.length} 중 {visitedCount}곳 방문
          </span>
          <span className="text-zinc-300" aria-hidden="true">|</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 font-medium">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-700" aria-hidden="true" />
            가 본 곳 (1회 이상)
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-300" aria-hidden="true" />
            안 가 본 곳 (0회)
          </span>
        </div>

        <div className="inline-flex rounded-xl bg-zinc-100 p-1 self-start sm:self-auto">
          {(
            [
              { id: 'all', label: '전체' },
              { id: 'visited', label: '가 본 곳' },
              { id: 'unvisited', label: '안 가 본 곳' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                filter === item.id
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error ? (
        <DbSetupNotice error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="h-18 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : filteredVenues.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-zinc-900">해당 조건의 공연장이 없어요</p>
          <p className="mt-1.5 text-xs text-zinc-500">
            {filter === 'visited'
              ? '아직 TOP 15 공연장 중 방문 기록이 없어요. 내 직관 기록장에서 공연을 기록해 보세요.'
              : '필터를 전체로 변경해 확인해 보세요.'}
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {filteredVenues.map((venue, index) => {
            const gigCount = Number(venue.공연수) || 0;
            const visitCount = Number(venue.간_횟수) || 0;
            const visited = visitCount > 0;
            const barWidthPct = Math.max(4, Math.round((gigCount / maxGigCount) * 100));
            const rank = venues.indexOf(venue) + 1 || index + 1;

            return (
              <li
                key={venue.공연장}
                className={`px-4 py-4 sm:px-6 transition-colors ${
                  visited ? 'bg-rose-50/40' : 'bg-white'
                }`}
              >
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span
                      className={`font-mono-tabular w-7 shrink-0 text-sm font-semibold ${
                        visited ? 'text-rose-700' : 'text-zinc-400'
                      }`}
                    >
                      {String(rank).padStart(2, '0')}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm sm:text-base font-semibold text-zinc-900">
                          {venue.공연장}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                        <span className="font-mono-tabular text-zinc-600">
                          전체 공연 {formatCount(gigCount)}건
                        </span>
                        <span className="text-zinc-300" aria-hidden="true">·</span>
                        {visited ? (
                          <span className="inline-flex items-center gap-1 font-medium text-rose-700">
                            <Check className="h-3.5 w-3.5" />
                            가 본 곳 ({formatCount(visitCount)}회 직관)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-500">
                            <MapPin className="h-3.5 w-3.5" />
                            안 가 본 곳
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Proportional bar */}
                  <div className="flex items-center gap-3 sm:w-56 shrink-0 pl-10 sm:pl-0">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${visited ? 'bg-rose-700' : 'bg-zinc-300'}`}
                        style={{ width: `${barWidthPct}%` }}
                      />
                    </div>
                    <span
                      className={`font-mono-tabular w-12 text-right text-xs font-semibold ${
                        visited ? 'text-rose-700' : 'text-zinc-500'
                      }`}
                    >
                      {formatCount(gigCount)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
