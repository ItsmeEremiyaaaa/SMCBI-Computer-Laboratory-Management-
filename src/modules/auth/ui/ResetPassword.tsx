import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { authRepo } from '../data/repository';
import { Alert, Button, Field, Input, Panel } from '../../../shared/ui/ui';

// Opened from the "reset your password" email: the link signs the user in, then they choose a new password.
export default function ResetPassword() {
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    if (pw !== again) return setError("The two passwords don't match.");
    setBusy(true); setError(null);
    try { await authRepo.updatePassword(pw); setDone(true); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md p-4 pt-8">
      <Panel className="p-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold text-rail"><KeyRound size={22} />Choose a new password</h1>
        {done ? (
          <div className="mt-4 grid gap-3">
            <p className="flex items-center gap-2 font-medium text-emerald-700"><CheckCircle2 size={20} />Password changed.</p>
            <Link to="/" className="font-medium text-accent hover:underline">Continue to ComLab Monitor</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-4">
            {error && <Alert>{error}</Alert>}
            <Field label="New password" hint="At least 8 characters"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="Type it again"><Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></Field>
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</Button>
          </form>
        )}
      </Panel>
    </div>
  );
}
