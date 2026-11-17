import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { DEPARTMENTS } from '../lib/types';
import { isSchoolEmail } from '../lib/validate';
import { Alert, Button, Field, Input, Select } from '../components/ui';
import AuthShell from './AuthShell';

export default function Signup() {
  const [f, setF] = useState({ full_name: '', email: '', password: '', department: 'BSIT', course: '' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isSchoolEmail(f.email)) return setError('Use your @smcbi.edu.ph email.');
    if (f.password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true); setError(null);
    try { await api.signUp(f); setDone(true); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <AuthShell>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-rail">Create a teacher account</h1>
      <p className="mt-1 text-sm text-muted">An admin approves new accounts before you can book labs.</p>
      {done ? (
        <p className="mt-6 rounded-md border border-line bg-panel p-4 text-sm">Account created. Check your email to confirm it, then sign in.</p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 grid gap-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Full name"><Input required value={f.full_name} onChange={set('full_name')} autoComplete="name" /></Field>
          <Field label="Email" hint="Must end with @smcbi.edu.ph"><Input type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></Field>
          <Field label="Password" hint="At least 8 characters"><Input type="password" required value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department"><Select value={f.department} onChange={set('department')}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
            <Field label="Course taught"><Input required value={f.course} onChange={set('course')} placeholder="e.g. Programming 1" /></Field>
          </div>
          <Button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted">Already registered? <Link to="/login" className="font-medium text-accent hover:underline">Sign in</Link></p>
    </AuthShell>
  );
}
