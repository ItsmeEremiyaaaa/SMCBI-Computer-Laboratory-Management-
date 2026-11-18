import { useState, type FormEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, MailCheck, User } from 'lucide-react';
import { api } from '../lib/api';
import { schoolEmail } from '../lib/validate';
import { Alert, Button } from '../components/ui';
import AuthShell from './AuthShell';

const REMEMBER_KEY = 'comlab-last-email';
const remembered = () => { try { return localStorage.getItem(REMEMBER_KEY) ?? ''; } catch { return ''; } };

// Underline field with a leading icon (the reference style), label kept for screen readers.
function LineField({ id, label, icon, hint, after, ...input }:
  { id: string; label: string; icon: ReactNode; hint?: ReactNode; after?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <div className="group mt-1 flex items-center gap-2.5 border-b-2 border-slate-200 pb-1.5 transition-colors focus-within:border-[#3b47b8]">
        <span className="text-slate-400 transition-colors group-focus-within:text-[#3b47b8]">{icon}</span>
        <input id={id} {...input} className="min-w-0 flex-1 bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-slate-300" />
        {after}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState(remembered);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => remembered() !== '');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const full = schoolEmail(email);
  const unconfirmed = !!error && /confirm/i.test(error);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null); setInfo(null);
    try { await fn(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await api.signIn(full, password);
      try { if (remember) localStorage.setItem(REMEMBER_KEY, full); else localStorage.removeItem(REMEMBER_KEY); } catch { /* private mode */ }
    });
  }
  const forgot = () => {
    if (!full) return setError('Type your email or student ID first, then tap “Forgot password?”.');
    run(async () => { await api.resetPassword(full); setInfo(`If ${full} has an account, a reset link is on its way. Check your inbox and spam folder.`); });
  };
  const resend = () => run(async () => { await api.resendConfirmation(full); setInfo(`Confirmation email sent again to ${full}.`); });
  const capsCheck = (e: KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false);

  return (
    <AuthShell>
      <h1 className="text-5xl font-extrabold tracking-tight text-[#1e2a6e] lg:text-4xl">Hello!</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to your <b className="text-[#3b47b8]">ComLab</b> account</p>

      <form onSubmit={submit} className="mt-7 grid gap-5">
        {error && <Alert>{error}</Alert>}
        {info && <p role="status" className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><MailCheck size={18} className="shrink-0" />{info}</p>}

        <LineField id="login-email" label="Email or student ID" icon={<User size={18} />} required value={email}
          onChange={(e) => setEmail(e.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false}
          placeholder="c230505" hint={email && !email.includes('@') ? <>Signing in as <b>{full}</b></> : undefined} />

        <LineField id="login-password" label="Password" icon={<Lock size={18} />} type={show ? 'text' : 'password'} required={!api.demo}
          value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={capsCheck} onKeyDown={capsCheck}
          autoComplete="current-password" placeholder="••••••••"
          hint={caps ? <span className="font-semibold text-amber-700">Caps Lock is on.</span> : undefined}
          after={
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
              className="rounded p-1 text-slate-400 hover:text-[#3b47b8]">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          } />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-500">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#3b47b8]" />
            Remember me
          </label>
          <button type="button" onClick={forgot} className="font-medium text-[#3b47b8] hover:underline">Forgot password?</button>
        </div>

        <button disabled={busy}
          className="group mt-1 flex h-12 items-center justify-between rounded-full bg-gradient-to-r from-[#3b47b8] to-[#5b6ee6] pl-6 pr-1.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 transition group-hover:translate-x-0.5">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          </span>
        </button>
        {unconfirmed && <Button type="button" variant="ghost" disabled={busy} onClick={resend}><MailCheck size={16} />Resend confirmation email</Button>}
      </form>

      {api.demo && (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-3 text-sm">
          <p className="font-medium">Demo accounts <span className="font-normal text-slate-500">(any password)</span></p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['admin', 'staff', 'teacher'] as const).map((r) => (
              <Button key={r} type="button" size="sm" variant="ghost" className="capitalize" onClick={() => api.signIn(`${r}@smcbi.edu.ph`, 'demo')}>{r}</Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => api.signIn('c230001@smcbi.edu.ph', 'demo')}>Student</Button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">Don’t have an account? <Link to="/signup" className="font-semibold text-[#3b47b8] hover:underline">Create one</Link></p>
    </AuthShell>
  );
}
