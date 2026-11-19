import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import type { ResStatus, ShownStatus } from '../data/types';

export const STATUS_COLOR: Record<ShownStatus, string> = {
  free: '#22c55e', in_use: '#3b82f6', reserved: '#f59e0b', maintenance: '#8b5cf6', broken: '#ef4444',
};
export const STATUS_LABEL: Record<ShownStatus, string> = {
  free: 'Free', in_use: 'In use', reserved: 'Reserved', maintenance: 'Maintenance', broken: 'Broken',
};
export const STATUSES: ShownStatus[] = ['free', 'in_use', 'reserved', 'maintenance', 'broken'];

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; size?: 'sm' | 'md' };
export function Button({ variant = 'primary', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        size === 'sm' ? 'h-8 px-2.5 text-sm' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-accent text-white shadow-sm hover:bg-rail',
        variant === 'ghost' && 'border border-line bg-panel hover:bg-chalk',
        variant === 'danger' && 'bg-broken text-white hover:bg-[#d83434]',
        variant === 'quiet' && 'text-muted hover:text-ink hover:bg-chalk',
        className,
      )}
    />
  );
}

export function Field({ label, error, children, hint, required }: { label: string; error?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}{required && <span className="text-broken" aria-hidden> *</span>}{required && <span className="sr-only"> (required)</span>}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && <span className="text-xs text-broken">{error}</span>}
    </label>
  );
}

const control = 'h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
// Full width unless the caller sets a width (two width classes conflict and CSS order, not class order, decides).
const controlClass = (extra?: string) => cx(control, !/(^|\s)(sm:|md:|lg:)?w-/.test(extra ?? '') && 'w-full', extra);
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={controlClass(p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={controlClass(p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...p} className={cx(control, 'h-auto min-h-20 py-2', p.className)} />;

export function Led({ status, className }: { status: ShownStatus; className?: string }) {
  return <span className={cx('led shrink-0', className)} style={{ color: STATUS_COLOR[status] }} aria-hidden />;
}

const RES_STYLE: Record<ResStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-red-50 text-red-800 ring-red-200',
  completed: 'bg-slate-100 text-slate-700 ring-slate-200',
  cancelled: 'bg-zinc-100 text-zinc-600 ring-zinc-300 line-through decoration-zinc-400',
};
export function ResBadge({ status }: { status: ResStatus }) {
  return <span className={cx('inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset', RES_STYLE[status])}>{status}</span>;
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, icon: Icon, actions, children, className }:
  { title?: string; icon?: LucideIcon; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card', className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
          <h2 className="flex items-center gap-2 font-semibold text-rail">
            {Icon && <span className="grid h-7 w-7 place-items-center rounded-md bg-gold-soft text-accent"><Icon size={15} strokeWidth={2} /></span>}
            {title}
          </h2>{actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export function Alert({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p>;
}

// Only one floating panel at a time (menu, bells, PC card…): opening one closes the others.
export function useExclusive(open: boolean, close: () => void) {
  const id = useId();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent('comlab:overlay', { detail: id }));
    const other = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) closeRef.current(); };
    window.addEventListener('comlab:overlay', other);
    return () => window.removeEventListener('comlab:overlay', other);
  }, [open, id]);
}

// ---- Toasts: short "done" messages that slide in at the bottom right and leave by themselves ----
type Toast = { id: number; title: string; sub?: string; tone: 'ok' | 'error' };
let pushToast: ((t: Toast) => void) | null = null;
let toastSeq = 0;
/** Shows a small confirmation, e.g. toast('Booking approved', 'Maria Santos was told'). */
export function toast(title: string, sub?: string, tone: Toast['tone'] = 'ok') { pushToast?.({ id: ++toastSeq, title, sub, tone }); }

/** Mounted once at the app root; renders the toasts. */
export function ToastHost() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      setList((l) => [...l.slice(-2), t]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 4200);
    };
    return () => { pushToast = null; };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-4 z-60 grid justify-items-end gap-2 sm:inset-x-auto sm:right-5">
      {list.map((t) => (
        <div key={t.id} role="status" className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-2xl">
          <span className={cx('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg', t.tone === 'ok' ? 'bg-emerald-500' : 'bg-broken')}>
            {t.tone === 'ok'
              ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="draw-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              : <X size={15} />}
          </span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t.title}</span>{t.sub && <span className="block text-xs text-white/70">{t.sub}</span>}</span>
          <button onClick={() => setList((l) => l.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="rounded p-0.5 text-white/60 hover:text-white"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

// ---- In-app confirm dialog (replaces the browser's confirm box) ----
type Ask = { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean };
let showAsk: ((a: Ask & { resolve: (ok: boolean) => void }) => void) | null = null;

/** Asks the user to confirm, in the app's own modal. Resolves true on confirm, false on cancel/close. */
export function askConfirm(a: Ask): Promise<boolean> {
  return new Promise((resolve) => {
    if (showAsk) showAsk({ ...a, resolve });
    else resolve(window.confirm(typeof a.message === 'string' ? a.message : a.title)); // host not mounted (tests)
  });
}

/** Mounted once at the app root; renders whatever askConfirm asks. */
export function ConfirmHost() {
  const [q, setQ] = useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);
  useEffect(() => {
    showAsk = (a) => setQ((prev) => { prev?.resolve(false); return a; });
    return () => { showAsk = null; };
  }, []);
  const done = (ok: boolean) => { q?.resolve(ok); setQ(null); };
  return (
    <Modal open={!!q} title={q?.title ?? ''} onClose={() => done(false)} hideClose>
      <p className="text-sm text-muted">{q?.message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant={q?.danger ? 'danger' : 'primary'} autoFocus onClick={() => done(true)}>{q?.confirmLabel ?? 'OK'}</Button>
      </div>
    </Modal>
  );
}

export function Modal({ open, title, onClose, children, wide = false, hideClose = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean; hideClose?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // jsdom has no showModal; fall back to a plain open dialog there.
    if (open && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    // showModal focuses the first button (the X); move focus to the field the dialog asks for, if any
    if (open) d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-label={title}
      className={`mb-0 mt-auto w-full max-w-full rounded-t-2xl border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-rail/50
        sm:m-auto sm:rounded-lg ${wide ? 'sm:w-[min(94vw,34rem)] lg:w-[min(94vw,62rem)]' : 'sm:w-[min(92vw,34rem)]'}`}>
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="min-w-0 truncate font-semibold">{title}</h2>
        {!hideClose && (
          <button onClick={onClose} aria-label="Close" className="shrink-0 rounded p-1 text-muted hover:bg-chalk"><X size={18} /></button>
        )}
      </div>
      <div className="max-h-[80dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[75vh] sm:p-5">{children}</div>
    </dialog>
  );
}

export const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// The college seal (public/smcbi-seal.webp), shown on a white disc so it reads on blue too.
export function Crest({ size = 40 }: { size?: number }) {
  return (
    <img src="/smcbi-seal.webp" width={size} height={size} alt="St. Mary's College of Bansalan seal"
      className="shrink-0 rounded-full bg-white p-0.5 shadow-sm" />
  );
}
