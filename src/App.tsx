/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Calendar, Home, MapPin } from 'lucide-react';
import { apiFetch } from './lib/api';
import type { HomeData, ScreenTab, UserItem } from './types/band';
import { HomeView } from './components/HomeView';
import { GigsView } from './components/GigsView';
import { VenuesView } from './components/VenuesView';
import { MyLogView } from './components/MyLogView';
import { Footer } from './components/Footer';

const NAV_ITEMS: Array<{ id: ScreenTab; label: string; mobileLabel: string; icon: typeof Home }> = [
  { id: 'home', label: '홈', mobileLabel: '홈', icon: Home },
  { id: 'gigs', label: '공연 찾기', mobileLabel: '공연 찾기', icon: Calendar },
  { id: 'venues', label: '공연장', mobileLabel: '공연장', icon: MapPin },
  { id: 'log', label: '내 직관 기록장', mobileLabel: '기록장', icon: BookOpen },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ScreenTab>('home');
  const [composerOpen, setComposerOpen] = useState(false);

  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<unknown>(null);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const fetchHome = useCallback(async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      const res = await apiFetch<HomeData>('/api/home');
      setHomeData(res);
    } catch (err) {
      setHomeError(err);
    } finally {
      setHomeLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch<{ users: UserItem[] }>('/api/users');
      setUsers(res.users);
      setSelectedUserId((prev) => {
        if (prev && res.users.some((u) => u.user_id === prev)) return prev;
        return res.users[0]?.user_id ?? null;
      });
    } catch {
      // Errors on DB setup are handled by active view's DbSetupNotice
    }
  }, []);

  useEffect(() => {
    fetchHome();
    fetchUsers();
  }, [fetchHome, fetchUsers]);

  function handleNavigate(tab: ScreenTab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOpenLogComposer() {
    setActiveTab('log');
    setComposerOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa] text-zinc-900">
      {/* Desktop & Mobile Top Navigation */}
      <header className="border-b border-zinc-200 bg-white md:sticky md:top-0 md:z-30">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="text-lg font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          >
            사운드로그
          </button>

          {/* Zone 2: Desktop Single-Line Nav Links */}
          <nav aria-label="주 메뉴" className="hidden md:flex items-center gap-7">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'text-zinc-900 font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-rose-700"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleOpenLogComposer}
              className="min-h-[40px] rounded-xl bg-rose-700 px-4 py-2 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-rose-800 whitespace-nowrap shrink-0"
            >
              직관 기록하기
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {activeTab === 'home' && (
          <HomeView
            data={homeData}
            loading={homeLoading}
            error={homeError}
            onRetry={() => {
              fetchHome();
              fetchUsers();
            }}
            onNavigate={handleNavigate}
            onOpenLogComposer={handleOpenLogComposer}
          />
        )}

        {activeTab === 'gigs' && <GigsView />}

        {activeTab === 'venues' && (
          <VenuesView
            users={users}
            selectedUserId={selectedUserId}
            onSelectUserId={setSelectedUserId}
          />
        )}

        {activeTab === 'log' && (
          <MyLogView
            users={users}
            selectedUserId={selectedUserId}
            onSelectUserId={setSelectedUserId}
            composerOpen={composerOpen}
            onComposerOpenChange={setComposerOpen}
          />
        )}
      </main>

      <Footer />

      {/* Mobile Fixed Bottom Navigation (60px height <= 15% viewport cap) */}
      <nav
        aria-label="모바일 하단 메뉴"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur-md md:hidden"
      >
        <div className="grid h-[60px] grid-cols-4 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? 'text-rose-700 font-semibold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                <span className="text-[11px] leading-none whitespace-nowrap">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
