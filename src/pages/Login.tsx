import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Alert, Button, Field, Input } from '../components/ui';
import AuthShell from './AuthShell';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.signIn(email, password); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Use your school account.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        <Field label="Password"><Input type="password" required={!api.demo} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <Button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      {api.demo && (
        <div className="mt-6 rounded-md border border-line bg-panel p-3 text-sm">
          <p className="font-medium">Demo accounts (any password)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['admin', 'staff', 'teacher'].map((r) => (
              <Button key={r} type="button" size="sm" variant="ghost" className="capitalize"
                onClick={() => api.signIn(`${r}@smcbi.edu.ph`, 'demo')}>{r}</Button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-6 text-sm text-muted">New teacher? <Link to="/signup" className="font-medium text-accent hover:underline">Create an account</Link></p>
    </AuthShell>
  );
}
