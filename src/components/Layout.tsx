import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { Box, CalendarClock, CalendarDays, ClipboardList, LayoutGrid, LogOut, Menu, QrCode, Users, X } from 'lucide-react';
import { Crest } from './ui';
import IntroSplash from './IntroSplash';
import { useAuth } from '../auth';
import { api, type Stats } from '../lib/api';
import type { Role } from '../lib/types';

const NAV: { to: string; label: string; icon: typeof Box; roles: Role[] }[] = [
  { to: '/', label: 'Overview', icon: LayoutGrid, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/labs', label: 'Labs', icon: Box, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/reservations', label: 'Reservations', icon: ClipboardList, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/schedule', label: 'Class schedule', icon: CalendarClock, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/people/teachers', label: 'People', icon: Users, roles: ['admin'] },
  { to: '/qr', label: 'PC QR codes', icon: QrCode, roles: ['admin', 'staff'] },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1">
      <span data-intro-target className="inline-flex rounded-full"><Crest size={40} /></span>
      <div className="leading-tight">
        <p className="text-[17px] font-bold tracking-tight text-white">ComLab Monitor</p>
        <p className="text-[11px] text-blue-200">St. Mary's College of Bansalan</p>
      </div>
    </div>
  );
}

export default function Layout() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const { pathname } = useLocation();
  const isLabs = pathname.startsWith('/labs');

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'staff') return;
    const load = () => api.stats().then(setStats).catch(() => {});
    load();
    return api.subscribeReservations(load);
  }, [profile?.role, pathname]);

  if (!profile) return null;
  const count = (stats?.pending ?? 0) + (profile.role === 'admin' ? stats?.pendingTeachers ?? 0 : 0);

  // Floating bottom navigation (active only on Labs view)
  const floatingNav = isLabs && (
    <nav
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-2xl border border-white/20 navy-weave p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200"
      aria-label="Floating navigation"
    >
      {NAV.filter((n) => n.roles.includes(profile.role)).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
              isActive || (to.startsWith('/people') && pathname.startsWith('/people'))
                ? 'bg-white text-rail shadow-md'
                : 'text-blue-100 hover:bg-white/15 hover:text-white'
            }`
          }
        >
          <Icon size={16} strokeWidth={2} />
          <span className="hidden sm:inline">{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  // When on Labs view: 100% full-window 3D visual with floating navigation below
  if (isLabs) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-[#dfe5ee]">
        <IntroSplash />
        {/* Floating top-right user and notification controls */}
        <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2">
          {api.demo && (
            <span className="pointer-events-auto rounded-xl border border-amber-200 bg-amber-100/90 px-2.5 py-1 text-xs font-medium text-amber-900 shadow-sm backdrop-blur">
              Demo mode
            </span>
          )}
          {(profile.role === 'admin' || profile.role === 'staff') && (
            <NotificationBell count={count} />
          )}
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line/60 bg-panel/90 p-1.5 shadow-md backdrop-blur">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-rail text-xs font-semibold text-white">
              {profile.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </span>
            <button onClick={() => api.signOut()} aria-label="Sign out" className="rounded-md p-1 text-muted hover:bg-chalk hover:text-ink">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Full-window content */}
        <main className="h-full w-full">
          <Outlet />
        </main>

        {/* Floating bottom navigation */}
        {floatingNav}
      </div>
    );
  }

  // Standard layout with left sidebar menu for all other navigation pages
  const nav = (
    <nav className="mt-8 grid gap-1">
      <p className="mb-1 px-3 text-[11px] font-medium text-blue-200/80">Menu</p>
      {NAV.filter((n) => n.roles.includes(profile.role)).map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive || (to.startsWith('/people') && pathname.startsWith('/people'))
              ? 'bg-white text-rail shadow-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}>
          <Icon size={18} strokeWidth={1.75} />{label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-full gap-3 p-0 md:p-3">
      <IntroSplash />
      <aside className="sticky top-3 hidden h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col rounded-2xl navy-weave p-4 shadow-lg md:flex print:!hidden">
        <Brand />{nav}
        <UserBox />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-rail/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col navy-weave p-4">
            <div className="flex items-center justify-between"><Brand />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-slate-300"><X /></button></div>
            {nav}<UserBox />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-chalk/85 px-4 backdrop-blur md:top-3 md:rounded-2xl md:px-6 print:hidden">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          {api.demo && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Demo mode, sample data</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {(profile.role === 'admin' || profile.role === 'staff') && (
              <NotificationBell count={count} />
            )}
          </div>
        </div>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 md:px-6"><Outlet /></main>
      </div>
    </div>
  );
}

function UserBox() {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <div className="mt-auto flex items-center gap-3 rounded-xl bg-white/10 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-rail">
        {profile.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{profile.full_name}</p>
        <p className="text-xs capitalize text-blue-200">{profile.role}</p>
      </div>
      <button onClick={() => api.signOut()} aria-label="Sign out" className="rounded-lg p-1.5 text-blue-200 hover:bg-white/15 hover:text-white"><LogOut size={18} /></button>
    </div>
  );
}
