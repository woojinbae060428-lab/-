import { useEffect, useState } from 'react';
import { Bell, Check, Plus, Search, Trash2, X } from 'lucide-react';
import { ApiError, apiFetch } from '../lib/api';
import { formatCount, formatKoreanDate } from '../lib/format';
import type { GigItem, MyLogData, UserItem } from '../types/band';
import { DbSetupNotice } from './DbSetupNotice';

interface PastGigsResponse {
  gigs: GigItem[];
  todayKst: string;
}

interface MyLogViewProps {
  users: UserItem[];
  selectedUserId: number | null;
  onSelectUserId: (id: number) => void;
  composerOpen: boolean;
  onComposerOpenChange: (open: boolean) => void;
}

export function MyLogView({
  users,
  selectedUserId,
  onSelectUserId,
  composerOpen,
  onComposerOpenChange,
}: MyLogViewProps) {
  const activeUserId = selectedUserId ?? users[0]?.user_id ?? null;

  const [logData, setLogData] = useState<MyLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Composer state (past gig picker + memo)
  const [pastSearch, setPastSearch] = useState('');
  const [debouncedPastSearch, setDebouncedPastSearch] = useState('');
  const [pastGigs, setPastGigs] = useState<GigItem[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [selectedGig, setSelectedGig] = useState<GigItem | null>(null);
  const [memo, setMemo] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Inline delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeUserId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch<MyLogData>(`/api/my-log?userId=${activeUserId}`)
      .then((res) => {
        if (cancelled) return;
        setLogData(res);
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
  }, [activeUserId, reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedPastSearch(pastSearch.trim());
    }, 200);
    return () => window.clearTimeout(timer);
  }, [pastSearch]);

  useEffect(() => {
    if (!composerOpen) return;

    let cancelled = false;
    setPastLoading(true);

    const params = new URLSearchParams({ tab: 'past' });
    if (debouncedPastSearch) {
      params.set('q', debouncedPastSearch);
    }

    apiFetch<PastGigsResponse>(`/api/gigs?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setPastGigs(res.gigs);
        setPastLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPastLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [composerOpen, debouncedPastSearch]);

  async function handleSaveAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!activeUserId || !selectedGig) {
      setSubmitError('기록할 지난 공연을 먼저 선택해 주세요.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await apiFetch('/api/attendances', {
        method: 'POST',
        body: JSON.stringify({
          userId: activeUserId,
          gigId: selectedGig.gig_id,
          memo: memo.trim(),
        }),
      });

      setSubmitSuccess(`"${selectedGig.gig_title}" 직관 기록을 남겼어요.`);
      setSelectedGig(null);
      setMemo('');
      onComposerOpenChange(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('직관 기록을 저장하지 못했어요.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAttendance(attendanceId: number) {
    if (!activeUserId) return;
    setDeletingId(attendanceId);
    setDeleteError(null);

    try {
      await apiFetch(`/api/attendances/${attendanceId}?userId=${activeUserId}`, {
        method: 'DELETE',
      });
      setConfirmDeleteId(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('기록을 삭제하지 못했어요.');
      }
    } finally {
      setDeletingId(null);
    }
  }

  const attendedSet = new Set(logData?.attendedGigIds ?? []);

  return (
    <div className="space-y-8">
      {/* Top Member Switcher & Action Bar */}
      <section className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">내 직관 기록장</h1>
          <p className="mt-1 text-sm text-zinc-600">
            회원을 선택해 직관한 공연 기록을 남기고, 팔로우한 밴드의 다음 공연 일정을 확인하세요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {users.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="log-user-select" className="text-xs font-medium text-zinc-500 whitespace-nowrap">
                회원
              </label>
              <select
                id="log-user-select"
                value={activeUserId ?? ''}
                onChange={(e) => {
                  onSelectUserId(Number(e.target.value));
                  setSubmitError(null);
                  setSubmitSuccess(null);
                  setConfirmDeleteId(null);
                }}
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

          <button
            type="button"
            onClick={() => {
              setSubmitError(null);
              setSubmitSuccess(null);
              onComposerOpenChange(!composerOpen);
            }}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-800 whitespace-nowrap"
          >
            {composerOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {composerOpen ? '닫기' : '기록하기'}
          </button>
        </div>
      </section>

      {/* Feedback banners */}
      {submitSuccess && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <Check className="h-4 w-4 text-emerald-700" />
            {submitSuccess}
          </span>
          <button
            type="button"
            onClick={() => setSubmitSuccess(null)}
            aria-label="알림 닫기"
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {deleteError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          {deleteError}
        </div>
      )}

      {/* Composer Panel: Log past gig */}
      {composerOpen && (
        <section
          aria-labelledby="record-composer-title"
          className="rounded-2xl border border-zinc-300 bg-white p-5 sm:p-6"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
            <div>
              <h2 id="record-composer-title" className="text-base font-semibold text-zinc-900">
                지난 공연 기록하기
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                이미 지난 공연({logData?.todayKst || '오늘'} 이전) 중 하나를 검색해 선택하고 한 줄 메모를 남겨 주세요.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveAttendance} className="mt-5 space-y-5">
            {/* Step 1: Search & choose past gig */}
            <div>
              <label htmlFor="past-gig-search" className="block text-xs font-medium text-zinc-700">
                1. 지난 공연 검색 및 선택
              </label>
              <div className="relative mt-2">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
                <input
                  id="past-gig-search"
                  type="search"
                  value={pastSearch}
                  onChange={(e) => setPastSearch(e.target.value)}
                  placeholder="공연명 또는 공연장으로 검색..."
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-zinc-50 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none"
                />
              </div>

              {selectedGig && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-rose-700 font-mono-tabular">
                      선택한 공연 · {formatKoreanDate(selectedGig.gig_date)}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900">
                      {selectedGig.gig_title}
                    </p>
                    <p className="truncate text-xs text-zinc-600">{selectedGig.venue_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGig(null)}
                    className="min-h-[36px] shrink-0 rounded-lg px-2.5 text-xs font-medium text-zinc-600 hover:bg-white hover:text-zinc-900"
                  >
                    변경
                  </button>
                </div>
              )}

              <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 divide-y divide-zinc-100">
                {pastLoading ? (
                  <p className="px-4 py-6 text-center text-xs text-zinc-500">지난 공연 목록을 불러오는 중...</p>
                ) : pastGigs.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-zinc-500">
                    검색 결과에 맞는 지난 공연이 없어요.
                  </p>
                ) : (
                  pastGigs.map((gig) => {
                    const isSelected = selectedGig?.gig_id === gig.gig_id;
                    const alreadyLogged = attendedSet.has(gig.gig_id);
                    return (
                      <button
                        key={gig.gig_id}
                        type="button"
                        onClick={() => {
                          setSelectedGig(gig);
                          setSubmitError(null);
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected ? 'bg-rose-50' : 'bg-white hover:bg-zinc-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="font-mono-tabular">{formatKoreanDate(gig.gig_date)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{gig.venue_name}</span>
                          </div>
                          <p className="mt-0.5 truncate text-sm font-medium text-zinc-900">
                            {gig.gig_title}
                          </p>
                        </div>
                        {alreadyLogged && (
                          <span className="shrink-0 text-xs font-medium text-zinc-400">기록됨</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Step 2: 1-line memo */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="attendance-memo" className="text-xs font-medium text-zinc-700">
                  2. 한 줄 메모 (200자 이내)
                </label>
                <span className="font-mono-tabular text-xs text-zinc-500">
                  {memo.length} / 200
                </span>
              </div>
              <input
                id="attendance-memo"
                type="text"
                maxLength={200}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 앵콜 떼창이 최고였고 사운드가 정말 좋았다"
                className="mt-2 h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
              />
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
              >
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => onComposerOpenChange(false)}
                className="min-h-[44px] rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedGig}
                className="min-h-[44px] rounded-xl bg-rose-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {submitting ? '저장 중...' : '직관 기록 저장'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Content */}
      {error ? (
        <DbSetupNotice error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : loading || !logData ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12" aria-busy="true">
          <div className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-white lg:col-span-7" />
          <div className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-white lg:col-span-5" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: v_my_log list + total count */}
          <section aria-labelledby="my-log-list-title" className="lg:col-span-7 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 id="my-log-list-title" className="text-base font-semibold text-zinc-900">
                {logData.user.nickname}님의 직관 기록
              </h2>
              <span className="font-mono-tabular text-sm font-semibold text-rose-700">
                누적 {formatCount(logData.totalCount)}회 관람
              </span>
            </div>

            {logData.logs.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-14 text-center">
                <p className="text-sm font-medium text-zinc-900">아직 남긴 직관 기록이 없어요</p>
                <p className="mt-1.5 text-xs text-zinc-500">
                  다녀온 공연을 찾아 한 줄 메모와 함께 첫 직관 기록을 남겨 보세요.
                </p>
                <button
                  type="button"
                  onClick={() => onComposerOpenChange(true)}
                  className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2 text-xs font-medium text-white hover:bg-rose-800"
                >
                  <Plus className="h-4 w-4" />
                  첫 공연 기록하기
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                {logData.logs.map((entry, idx) => {
                  const aid = entry.attendance_id;
                  const isConfirming = aid !== null && confirmDeleteId === aid;
                  const isDeleting = aid !== null && deletingId === aid;

                  return (
                    <li
                      key={aid ?? `${entry.날짜}-${entry.공연}-${idx}`}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                          <span className="font-mono-tabular font-medium text-zinc-700">
                            {formatKoreanDate(entry.날짜)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{entry.공연장}</span>
                        </div>
                        <h3 className="mt-1 text-sm sm:text-base font-semibold text-zinc-900">
                          {entry.공연}
                        </h3>
                        {entry.메모 ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">
                            {entry.메모}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-zinc-400">남긴 메모 없음</p>
                        )}
                      </div>

                      {aid !== null && (
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                          {isConfirming ? (
                            <>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => handleDeleteAttendance(aid)}
                                className="min-h-[38px] rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap"
                              >
                                {isDeleting ? '삭제 중...' : '삭제 확인'}
                              </button>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[38px] rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(aid)}
                              aria-label={`${entry.공연} 기록 삭제`}
                              className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 whitespace-nowrap"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              삭제
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Right: v_follow_upcoming */}
          <section aria-labelledby="follow-upcoming-title" className="lg:col-span-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 id="follow-upcoming-title" className="inline-flex items-center gap-1.5 text-base font-semibold text-zinc-900">
                <Bell className="h-4 w-4 text-rose-700" aria-hidden="true" />
                팔로우한 밴드의 다가오는 공연
              </h2>
              <span className="font-mono-tabular text-xs font-medium text-zinc-500">
                {formatCount(logData.followUpcoming.length)}건
              </span>
            </div>

            {logData.followUpcoming.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-10 text-center">
                <p className="text-sm font-medium text-zinc-900">예정된 팔로우 밴드 공연이 없어요</p>
                <p className="mt-1.5 text-xs text-zinc-500">
                  공연 찾기 화면에서 전체 다가오는 공연을 확인해 보세요.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                {logData.followUpcoming.map((item, idx) => (
                  <li key={`${item.날짜}-${item.밴드}-${item.공연}-${idx}`} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                      <span className="font-mono-tabular font-medium text-rose-700">
                        {formatKoreanDate(item.날짜)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-zinc-800">{item.밴드}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">{item.공연}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{item.공연장}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
