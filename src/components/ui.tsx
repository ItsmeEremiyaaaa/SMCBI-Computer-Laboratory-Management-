import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import type { ResStatus, ShownStatus } from '../lib/types';

export const STATUS_COLOR: Record<ShownStatus, string> = {
  free: '#22c55e', in_use: '#3b82f6', reserved: '#f59e0b', broken: '#ef4444',
};
export const STATUS_LABEL: Record<ShownStatus, string> = {
  free: 'Free', in_use: 'In use', reserved: 'Reserved', broken: 'Broken',
};
export const STATUSES: ShownStatus[] = ['free', 'in_use', 'reserved', 'broken'];

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; size?: 'sm' | 'md' };
export function Button({ variant = 'primary', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        size === 'sm' ? 'h-8 px-2.5 text-sm' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-accent text-white hover:bg-[#174d9e]',
        variant === 'ghost' && 'border border-line bg-panel hover:bg-chalk',
        variant === 'danger' && 'bg-broken text-white hover:bg-[#d83434]',
        variant === 'quiet' && 'text-muted hover:text-ink hover:bg-chalk',
        className,
      )}
    />
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && <span className="text-xs text-broken">{error}</span>}
    </label>
  );
}

const control = 'h-10 w-full rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(control, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(control, p.className)} />;
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
};
export function ResBadge({ status }: { status: ResStatus }) {
  return <span className={cx('inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset', RES_STYLE[status])}>{status}</span>;
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-line bg-panel', className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="font-semibold">{title}</h2>{actions}
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

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // jsdom has no showModal; fall back to a plain open dialog there.
    if (open && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-label={title}
      className="m-auto w-[min(92vw,34rem)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-rail/50">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-chalk"><X size={18} /></button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}

export const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
