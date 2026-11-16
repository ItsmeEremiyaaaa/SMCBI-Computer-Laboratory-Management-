import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, Box, CalendarDays, ClipboardList, LayoutGrid, LogOut, Menu, Users, X } from 'lucide-react';
import { useAuth } from '../auth';
import { api, type Stats } from '../lib/api';
import type { Role } from '../lib/types';

const NAV: { to: string; label: string; icon: typeof Box; roles: Role[] }[] = [
  { to: '/', label: 'Overview', icon: LayoutGrid, roles: ['admin', 'staff', 'teacher'] },
  { to: '/labs', label: 'Labs', icon: Box, roles: ['admin', 'staff', 'teacher'] },
  { to: '/reservations', label: 'Reservations', icon: ClipboardList, roles: ['admin', 'staff', 'teacher'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['admin', 'staff', 'teacher'] },
  { to: '/people/teachers', label: 'People', icon: Users, roles: ['admin'] },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="grid grid-cols-3 gap-[3px]" aria-hidden>
        {['#22c55e', '#22c55e', '#3b82f6', '#f59e0b', '#22c55e', '#22c55e'].map((c, i) =>
          <span key={i} className="h-1.5 w-2 rounded-[1px]" style={{ background: c }} />)}
      </span>
      <span className="font-cond text-lg font-semibold tracking-tight text-white">ComLab Monitor</span>
    </div>
  );
}

export default function Layout() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (profile?.role === 'teacher') return;
    const load = () => api.stats().then(setStats).catch(() => {});
    load();
    return api.subscribeReservations(load);
  }, [profile?.role, pathname]);

  if (!profile) return null;
  const count = (stats?.pending ?? 0) + (profile.role === 'admin' ? stats?.pendingTeachers ?? 0 : 0);

  const nav = (
    <nav className="mt-6 grid gap-0.5">
      {NAV.filter((n) => n.roles.includes(profile.role)).map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'}
          className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
            isActive || (to.startsWith('/people') && pathname.startsWith('/people'))
              ? 'bg-rail-2 text-white' : 'text-slate-300 hover:bg-rail-2/60 hover:text-white'}`}>
          <Icon size={18} strokeWidth={1.75} />{label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-rail p-4 md:flex">
        <Brand />{nav}
        <UserBox />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-rail/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-rail p-4">
            <div className="flex items-center justify-between"><Brand />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-slate-300"><X /></button></div>
            {nav}<UserBox />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-chalk/90 px-4 backdrop-blur md:px-8">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          {api.demo && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Demo mode, sample data</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {profile.role !== 'teacher' && (
              <NavLink to={profile.role === 'admin' && !stats?.pending && stats?.pendingTeachers ? '/people/teachers' : '/reservations?status=pending'}
                className="relative rounded-md p-2 text-muted hover:bg-panel hover:text-ink"
                aria-label={`${count} items need attention`}>
                <Bell size={20} />
                {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-broken px-1 text-[11px] font-semibold text-white">{count}</span>}
              </NavLink>
            )}
          </div>
        </div>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8"><Outlet /></main>
      </div>
    </div>
  );
}

function UserBox() {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <div className="mt-auto flex items-center gap-3 rounded-md border border-rail-2 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">
        {profile.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{profile.full_name}</p>
        <p className="text-xs capitalize text-slate-400">{profile.role}</p>
      </div>
      <button onClick={() => api.signOut()} aria-label="Sign out" className="rounded p-1.5 text-slate-400 hover:bg-rail-2 hover:text-white"><LogOut size={18} /></button>
    </div>
  );
}
