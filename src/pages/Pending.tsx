import { api } from '../lib/api';
import { useAuth } from '../auth';
import { Button } from '../components/ui';
import AuthShell from './AuthShell';

export default function Pending() {
  const { profile, refresh } = useAuth();
  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold tracking-tight text-[#1e2a6e]">Almost there!</h1>
      <p className="mt-3 text-sm text-muted">
        Thanks, {profile?.full_name}. A lab administrator needs to approve <b>{profile?.email}</b> before you can view the labs or book them.
      </p>
      {profile?.role === 'student' && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your email didn't match a student record, so it wasn't approved automatically. Signing up with your student-ID email
          (e.g. c230505@smcbi.edu.ph) is approved right away; otherwise ask the lab office to add your record.
        </p>
      )}
      <p className="mt-3 text-sm text-muted">Check back later or ask the lab office.</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => refresh()}>Check again</Button>
        <Button variant="ghost" onClick={() => api.signOut()}>Sign out</Button>
      </div>
    </AuthShell>
  );
}
