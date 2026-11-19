import { useState, type FormEvent } from 'react';
import { LogOut, Mail, Moon, Palette, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/auth';
import { authRepo } from '../data/repository';
import { peopleRepo } from '../../people/data/repository';
import { Alert, Button, Field, Input, PageHeader, toast } from '../../../shared/ui/ui';
import { applyTheme, savedTheme } from '../../../app/TopBar';

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

// Your own account: who you are, your contact details, and your password.
export default function Profile() {
  const { profile, refresh } = useAuth();
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(savedTheme);

  const switchTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    applyTheme(t);
    try { localStorage.setItem('comlab-theme', t); } catch { /* private mode */ }
  };
  if (!profile) return null;

  async function saveDetails(e: FormEvent) {
    e.preventDefault(); setError(null);
    if (phone && !/^\d{11}$/.test(phone)) return setError('Phone must be 11 digits, e.g. 09171234567.');
    setBusy(true);
    try { await peopleRepo.updateProfile(profile!.id, { phone: phone || null, address: address.trim() || null }); await refresh(); toast('Details saved'); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault(); setPwError(null);
    if (pw.length < 8) return setPwError('Use at least 8 characters.');
    if (pw !== pw2) return setPwError("The two passwords don't match.");
    setBusy(true);
    try { await authRepo.updatePassword(pw); setPw(''); setPw2(''); toast('Password changed', 'Use it the next time you sign in'); }
    catch (err) { setPwError((err as Error).message); } finally { setBusy(false); }
  }

  const facts: [string, string | null][] = [
    ['Role', profile.role], ['Department', profile.department],
    [profile.role === 'student' ? 'Year and section' : 'Course taught', profile.course],
  ];
  return (
    <>
      <PageHeader title="Profile" sub="Your account details and password." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <section className="card flex flex-col items-center p-6 text-center">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-accent text-3xl font-bold text-white shadow-xl shadow-accent/30">{initials(profile.full_name)}</span>
          <h2 className="mt-4 text-xl font-bold text-ink">{profile.full_name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Mail size={14} />{profile.email}</p>
          <span className="soft-chip mt-3 flex items-center gap-1.5 text-xs font-semibold capitalize text-accent"><ShieldCheck size={13} />{profile.role}</span>
          <dl className="mt-5 grid w-full gap-2 text-left text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 rounded-xl bg-chalk/70 px-3 py-2"><dt className="text-muted">{k}</dt><dd className="font-medium capitalize text-ink">{v || '—'}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">Your name, email and role are changed by the lab admin.</p>
          <Button variant="ghost" className="mt-4 w-full" onClick={() => authRepo.signOut()}><LogOut size={16} />Sign out</Button>
        </section>

        <div className="grid content-start gap-5">
          <form onSubmit={saveDetails} className="card grid gap-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><UserRound size={18} className="text-accent" />Contact details</h2>
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone" hint="11 digits, e.g. 09171234567"><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" maxLength={11} /></Field>
              <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
            </div>
            <div className="flex justify-end"><Button disabled={busy}>Save details</Button></div>
          </form>

          <form onSubmit={changePassword} className="card grid gap-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><ShieldCheck size={18} className="text-accent" />Change password</h2>
            {pwError && <Alert>{pwError}</Alert>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New password" hint="At least 8 characters"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
              <Field label="Type it again"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
            </div>
            <div className="flex justify-end"><Button disabled={busy || !pw}>Change password</Button></div>
          </form>

          <div className="card grid gap-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><Palette size={18} className="text-accent" />Theme appearance</h2>
            <p className="text-xs text-muted">Choose how ComLab Monitor looks on this device.</p>
            <div className="flex items-center gap-3">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTheme(t)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold capitalize transition-all ${
                    theme === t ? 'border-accent bg-accent-soft text-ink shadow-sm ring-2 ring-accent/20' : 'border-line bg-panel text-muted hover:bg-chalk hover:text-ink'
                  }`}
                >
                  {t === 'light' ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{t} mode</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
