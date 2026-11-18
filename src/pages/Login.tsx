import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LogIn, MailCheck } from 'lucide-react';
import { api } from '../lib/api';
import { schoolEmail } from '../lib/validate';
import { Alert, Button, Field, Input } from '../components/ui';
import AuthShell from './AuthShell';

const REMEMBER_KEY = 'comlab-last-email';
const remembered = () => { try { return localStorage.getItem(REMEMBER_KEY) ?? ''; } catch { return ''; } };

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
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-rail">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in with your school account.</p>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        {error && <Alert>{error}</Alert>}
        {info && <p role="status" className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><MailCheck size={18} className="shrink-0" />{info}</p>}

        <Field label="Email or student ID" hint={email && !email.includes('@') ? `Signing in as ${full}` : 'e.g. c230505 or name@smcbi.edu.ph'}>
          <Input required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" inputMode="email"
            autoCapitalize="none" spellCheck={false} placeholder="c230505" />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="pw" className="text-sm font-medium">Password</label>
            <button type="button" onClick={forgot} className="text-xs font-medium text-accent hover:underline">Forgot password?</button>
          </div>
          <div className="relative">
            <Input id="pw" type={show ? 'text' : 'password'} required={!api.demo} value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyUp={capsCheck} onKeyDown={capsCheck} autoComplete="current-password" className="pr-11" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {caps && <p className="mt-1 text-xs font-medium text-amber-700">Caps Lock is on.</p>}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Remember my email on this device
        </label>

        <Button disabled={busy} className="h-11 text-base">
          {busy ? <><Loader2 size={18} className="animate-spin" />Signing in…</> : <><LogIn size={18} />Sign in</>}
        </Button>
        {unconfirmed && <Button type="button" variant="ghost" disabled={busy} onClick={resend}><MailCheck size={16} />Resend confirmation email</Button>}
      </form>

      {api.demo && (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-chalk/60 p-3 text-sm">
          <p className="font-medium">Demo accounts <span className="font-normal text-muted">(any password)</span></p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['admin', 'staff', 'teacher'] as const).map((r) => (
              <Button key={r} type="button" size="sm" variant="ghost" className="capitalize" onClick={() => api.signIn(`${r}@smcbi.edu.ph`, 'demo')}>{r}</Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => api.signIn('c230001@smcbi.edu.ph', 'demo')}>Student</Button>
          </div>
        </div>
      )}

      <p className="mt-6 text-sm text-muted">No account yet? <Link to="/signup" className="font-medium text-accent hover:underline">Create one</Link> — students and teachers.</p>
    </AuthShell>
  );
}
