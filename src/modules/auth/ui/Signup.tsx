import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authRepo } from '../data/repository';
import { DEPARTMENTS } from '../../../shared/data/types';
import { isSchoolEmail, schoolEmail } from '../logic/email';
import { Alert, Button, Field, Input, Select } from '../../../shared/ui/ui';
import AuthShell from './AuthShell';

export default function Signup() {
  const [f, setF] = useState({ full_name: '', email: '', password: '', department: 'BSIT', course: '', account_type: 'student' as 'student' | 'teacher' });
  const student = f.account_type === 'student';
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const email = schoolEmail(f.email);
    if (!isSchoolEmail(email)) return setError('Use your @smcbi.edu.ph email.');
    if (f.password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true); setError(null);
    try { await authRepo.signUp({ ...f, email }); setDone(true); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <AuthShell>
      <h1 className="text-4xl font-extrabold tracking-tight text-[#1e2a6e]">Create Account</h1>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel p-1" role="group" aria-label="I am a">
        {(['student', 'teacher'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setF({ ...f, account_type: t })} aria-pressed={f.account_type === t}
            className={`rounded-md py-2 text-sm font-semibold capitalize ${f.account_type === t ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
            {t}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{student
        ? 'Use your school email (e.g. c230505@smcbi.edu.ph). If it matches your student record, you can sign in right away.'
        : 'An admin approves new teacher accounts before you can book labs.'}</p>
      {done ? (
        <p className="mt-6 rounded-md border border-line bg-panel p-4 text-sm">Account created. Check your email to confirm it, then sign in.</p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 grid gap-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Full name" hint={student ? 'Your name from the student record is used if it matches.' : undefined}><Input required value={f.full_name} onChange={set('full_name')} autoComplete="name" /></Field>
          <Field label={student ? 'Email or student ID' : 'Email'} hint={f.email && !f.email.includes('@') ? `Your email: ${schoolEmail(f.email)}` : 'Must end with @smcbi.edu.ph'}>
            <Input required value={f.email} onChange={set('email')} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder={student ? 'c230505' : 'name@smcbi.edu.ph'} /></Field>
          <Field label="Password" hint="At least 8 characters"><Input type="password" required value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
          {!student && <div className="grid grid-cols-2 gap-3">
            <Field label="Department"><Select value={f.department} onChange={set('department')}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
            <Field label="Course taught"><Input required value={f.course} onChange={set('course')} placeholder="e.g. Programming 1" /></Field>
          </div>}
          <Button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted">Already registered? <Link to="/login" className="font-medium text-accent hover:underline">Sign in</Link></p>
    </AuthShell>
  );
}
