import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { Download, MessageCircle, Moon, Plus, Search, Sun, UserRound, type LucideIcon } from 'lucide-react';
import { useMessages } from '../modules/messages/hooks/useMessages';
import type { Role } from '../shared/data/types';
import { bookingsRepo } from '../modules/bookings/data/repository';
import { labsRepo } from '../modules/labs/data/repository';
import { toast } from '../shared/ui/ui';

// ---- theme: light / dark, remembered per device ----
const THEME_KEY = 'comlab-theme';
export const savedTheme = (): 'light' | 'dark' => { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };
export const applyTheme = (t: 'light' | 'dark') => document.documentElement.classList.toggle('dark', t === 'dark');

type Cmd = { label: string; hint: string; to: string; icon?: LucideIcon; roles?: Role[] };

/** Top bar: quick tabs, search / command box (Ctrl+K), light/dark switch, bells, export, main action. */
export default function TopBar({ role, pages, bells, start }: { role: Role; pages: { to: string; label: string; icon: LucideIcon }[]; bells: ReactNode; start?: ReactNode }) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(savedTheme);
  useEffect(() => { applyTheme(theme); try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ } }, [theme]);
  // the new theme is revealed by a circle growing from the click; browsers without view transitions fade the colours
  function switchTheme(t: 'light' | 'dark', e: React.MouseEvent) {
    if (t === theme) return;
    const root = document.documentElement;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (calm) { setTheme(t); return; }
    if (!document.startViewTransition) {
      root.classList.add('theme-fade'); setTheme(t);
      setTimeout(() => root.classList.remove('theme-fade'), 600);
      return;
    }
    const x = e.clientX, y = e.clientY;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('liquid-switching');
    const vt = document.startViewTransition(() => { flushSync(() => setTheme(t)); applyTheme(t); });
    vt.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
    )).catch(() => {});
    vt.finished.finally(() => root.classList.remove('liquid-switching'));
  }

  // tabs for things the sidebar doesn't have: your profile and your messages (with unread count)
  const { unread } = useMessages();
  const tabs = [
    { to: '/profile', label: 'Profile', icon: UserRound, badge: 0 },
    { to: '/messages', label: 'Messages', icon: MessageCircle, badge: unread },
  ];
  const student = role === 'student';
  const staff = role === 'admin' || role === 'staff';

  // ---- search / command box ----
  const commands: Cmd[] = useMemo(() => [
    ...pages.map((p) => ({ label: p.label, hint: 'Go to page', to: p.to, icon: p.icon })),
    { label: 'Messages', hint: 'Chat', to: '/messages', icon: MessageCircle }, { label: 'Profile', hint: 'Your account', to: '/profile', icon: UserRound },
    { label: student ? 'Book a NetLab PC' : 'Request a lab', hint: 'New booking', to: student ? '/reservations?new=1&lab=netlab' : '/reservations?new=1', icon: Plus },
    ...(student ? [] : [{ label: 'Pending requests', hint: 'Reservations', to: '/reservations?status=pending' }]),
    { label: 'ComLab 1', hint: 'Open the lab', to: '/labs/lab1' }, { label: 'ComLab 2', hint: 'Open the lab', to: '/labs/lab2' },
    { label: 'NetLab', hint: 'Open the lab', to: '/labs/netlab' },
    ...(role === 'admin' ? [{ label: 'Student records', hint: 'People', to: '/people/students' }, { label: 'Student accounts', hint: 'People', to: '/people/accounts' }] : []),
  ], [pages, student, role]);
  const [q, setQ] = useState('');
  const [openList, setOpenList] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = commands.filter((c) => !q.trim() || `${c.label} ${c.hint}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const go = (c?: Cmd) => { if (!c) return; navigate(c.to); setQ(''); setOpenList(false); input.current?.blur(); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); setOpenList(true); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- export bookings to Excel (staff) ----
  async function exportBookings() {
    try {
      const [rows, labs, pcs] = await Promise.all([bookingsRepo.listReservations(), labsRepo.listLabs(), labsRepo.listPcs()]);
      const { Workbook } = await import('exceljs');
      const wb = new Workbook(); const ws = wb.addWorksheet('Bookings');
      ws.addRow(['Date', 'Start', 'End', 'Lab', 'PC', 'Title', 'Purpose', 'Requested by', 'For class', 'Participants', 'Requirements', 'Status', 'Admin note']).font = { bold: true };
      for (const r of [...rows].sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))) {
        ws.addRow([r.date, r.start_time, r.end_time, labs.find((l) => l.id === r.lab_id)?.name ?? r.lab_id, r.pc_id ? pcs.find((p) => p.id === r.pc_id)?.label ?? r.pc_id : 'Whole lab',
          r.title, r.purpose, r.requester_name, r.section ?? '', r.participants ?? '', r.requirements ?? '', r.status, r.admin_notes ?? '']);
      }
      ws.columns.forEach((c, i) => { c.width = [12, 8, 8, 24, 10, 28, 28, 24, 10, 12, 28, 11, 30][i]; });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = `ComLab bookings ${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
      toast('Bookings exported', `${rows.length} bookings saved to Excel`);
    } catch (e) { toast("Couldn't export", (e as Error).message, 'error'); }
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-5">
      {start}
      {/* quick tabs with an underline that slides in */}
      <nav aria-label="Quick tabs" className="hidden items-center gap-5 lg:flex">
        {tabs.map(({ to, label, icon: Icon, badge }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
            `group relative flex items-center gap-1.5 py-2 text-sm font-semibold transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            {({ isActive }) => (<><Icon size={15} />{label}{badge > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-broken px-1 text-[10px] font-bold text-white">{badge}</span>}
              <span className={`absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-ink transition-transform duration-300 ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'}`} /></>)}
          </NavLink>
        ))}
      </nav>

      {/* search or type command */}
      <div className="relative hidden min-w-0 max-w-sm flex-1 md:block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input ref={input} value={q} placeholder="Search or type command" aria-label="Search pages and actions" role="combobox" aria-expanded={openList}
          onChange={(e) => { setQ(e.target.value); setSel(0); setOpenList(true); }}
          onFocus={() => setOpenList(true)} onBlur={() => setTimeout(() => setOpenList(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === 'Enter') go(results[sel]);
            if (e.key === 'Escape') { setOpenList(false); input.current?.blur(); }
          }}
          className="h-10 w-full rounded-xl border border-line bg-panel pl-9 pr-14 text-sm text-ink outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-line px-1.5 text-[10px] text-muted">Ctrl K</kbd>
        {openList && results.length > 0 && (
          <ul role="listbox" className="toast-in absolute inset-x-0 top-12 z-50 overflow-hidden rounded-2xl border border-line bg-panel p-1.5 shadow-2xl">
            {results.map((c, i) => {
              const Icon = c.icon ?? Search;
              return (
                <li key={c.label + c.to} role="option" aria-selected={i === sel}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); go(c); }} onMouseEnter={() => setSel(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${i === sel ? 'bg-accent-soft text-ink' : 'text-ink'}`}>
                    <Icon size={16} className="text-accent" /><span className="flex-1">{c.label}</span><span className="text-xs text-muted">{c.hint}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* light / dark with a sliding pill */}
        <div role="radiogroup" aria-label="Theme" className="relative grid grid-cols-2 rounded-xl bg-chalk p-1 text-xs font-semibold ring-1 ring-line">
          <span aria-hidden className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-accent shadow-md shadow-accent/30 transition-transform duration-300 ${theme === 'dark' ? 'translate-x-full' : ''}`} />
          {(['light', 'dark'] as const).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} onClick={(e) => switchTheme(t, e)}
              className={`relative z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 capitalize transition-colors sm:px-3 ${theme === t ? 'text-white' : 'text-muted hover:text-ink'}`}>
              {t === 'light'
                ? <Sun size={14} className={`transition-transform duration-700 ease-[cubic-bezier(.34,1.56,.64,1)] ${theme === 'light' ? 'rotate-90 scale-110' : ''}`} />
                : <Moon size={14} className={`transition-transform duration-700 ease-[cubic-bezier(.34,1.56,.64,1)] ${theme === 'dark' ? '-rotate-[20deg] scale-110' : ''}`} />}<span className="hidden sm:inline">{t}</span>
            </button>
          ))}
        </div>
        {bells}
        {staff && (
          <button onClick={exportBookings} className="hidden items-center gap-2 rounded-xl bg-chalk py-1 pl-3 pr-1 text-sm font-semibold text-ink ring-1 ring-line hover:bg-accent-soft lg:flex">
            Export data<span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white"><Download size={15} /></span>
          </button>
        )}
        <button onClick={() => navigate(student ? '/reservations?new=1&lab=netlab' : '/reservations?new=1')}
          className="hidden rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-panel shadow-sm transition-transform hover:scale-[1.03] sm:block">
          {student ? 'Book a NetLab PC' : 'Request a lab'}
        </button>
      </div>
    </div>
  );
}
