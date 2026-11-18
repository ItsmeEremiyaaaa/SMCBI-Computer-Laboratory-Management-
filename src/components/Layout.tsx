import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import StudentBell from './StudentBell';
import { Archive, Box, CalendarClock, CalendarDays, ClipboardList, LayoutGrid, LogOut, Menu, PanelLeftClose, PanelLeftOpen, QrCode, Users, X } from 'lucide-react';
import { Crest } from './ui';
import IntroSplash from './IntroSplash';
import { useAuth } from '../auth';
import { api, type Stats } from '../lib/api';
import type { Role } from '../lib/types';

const COLLAPSED_KEY = 'comlab-sidebar-collapsed';

const NAV: { to: string; label: string; icon: typeof Box; roles: Role[] }[] = [
  { to: '/', label: 'Overview', icon: LayoutGrid, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/labs', label: 'Labs', icon: Box, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/reservations', label: 'Reservations', icon: ClipboardList, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/schedule', label: 'Class schedule', icon: CalendarClock, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['admin', 'staff', 'teacher', 'student'] },
  { to: '/people/teachers', label: 'People', icon: Users, roles: ['admin'] },
  { to: '/qr', label: 'PC QR codes', icon: QrCode, roles: ['admin', 'staff'] },
  { to: '/archive', label: 'Archive', icon: Archive, roles: ['admin'] },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span data-intro-target className="inline-flex shrink-0 rounded-full"><Crest size={40} /></span>
      <div className={compact ? 'sr-only' : 'min-w-0 leading-tight'}>
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
  // Desktop sidebar can collapse to an icon rail (remembered per device).
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; } });
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '0' : '1'); } catch { /* private mode */ }
  };
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
  const count = (stats?.pending ?? 0) + (stats?.openReports ?? 0) + (profile.role === 'admin' ? stats?.pendingTeachers ?? 0 : 0);

  // Left sidebar menu (all pages, Labs included); `compact` = the collapsed icon rail
  const nav = (compact: boolean) => (
    <nav className="mt-8 grid gap-1">
      <p className={compact ? 'sr-only' : 'mb-1 px-3 text-[11px] font-medium text-blue-200/80'}>Menu</p>
      {NAV.filter((n) => n.roles.includes(profile.role)).map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} title={compact ? label : undefined} aria-label={compact ? label : undefined}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${compact ? 'justify-center px-0' : 'px-3'} ${
            isActive || (to.startsWith('/people') && pathname.startsWith('/people'))
              ? 'bg-white text-rail shadow-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}>
          <Icon size={18} strokeWidth={1.75} className="shrink-0" />{!compact && label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className={`flex gap-3 p-0 md:p-3 ${isLabs ? 'h-screen overflow-hidden' : 'min-h-full'}`}>
      <IntroSplash />
      <aside className={`sticky top-3 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-2xl navy-weave shadow-lg transition-[width] duration-200 md:flex print:!hidden ${
        collapsed ? 'w-[4.5rem] px-2.5 py-4' : 'w-64 p-4'}`}>
        <Brand compact={collapsed} />
        <button onClick={toggleCollapsed} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={collapsed ? 'Expand menu' : 'Collapse menu'}
          className={`mt-4 flex items-center gap-2 rounded-lg py-1.5 text-xs font-medium text-blue-200 hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center' : 'px-3'}`}>
          {collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={16} />Collapse menu</>}
        </button>
        {nav(collapsed)}
        <UserBox compact={collapsed} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-rail/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col navy-weave p-4">
            <div className="flex items-center justify-between"><Brand />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-slate-300"><X /></button></div>
            {nav(false)}<UserBox />
          </aside>
        </div>
      )}

      <div className={`flex min-w-0 flex-1 flex-col ${isLabs ? 'min-h-0' : ''}`}>
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-chalk px-4 md:static md:bg-transparent md:px-6 print:hidden">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          {api.demo && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Demo mode, sample data</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {(profile.role === 'admin' || profile.role === 'staff') && (
              <NotificationBell count={count} />
            )}
            {profile.role === 'student' && <StudentBell />}
          </div>
        </div>
        {isLabs
          // Labs fills the rest of the screen (floor plan / 3D), in a rounded panel like the sidebar
          ? <main className="relative min-h-0 flex-1 overflow-hidden md:rounded-2xl"><Outlet /></main>
          : <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 md:px-6"><Outlet /></main>}
      </div>
    </div>
  );
}

function UserBox({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (compact) {
    return (
      <div className="mt-auto grid justify-items-center gap-2" title={`${profile.full_name} · ${profile.role}`}>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-sm font-semibold text-rail">
          {profile.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </span>
        <button onClick={() => api.signOut()} aria-label="Sign out" title="Sign out" className="rounded-lg p-1.5 text-blue-200 hover:bg-white/15 hover:text-white"><LogOut size={18} /></button>
      </div>
    );
  }
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
