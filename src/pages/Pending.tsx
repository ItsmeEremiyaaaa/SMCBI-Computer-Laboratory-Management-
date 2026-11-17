import { api } from '../lib/api';
import { useAuth } from '../auth';
import { Button } from '../components/ui';
import AuthShell from './AuthShell';

export default function Pending() {
  const { profile, refresh } = useAuth();
  return (
    <AuthShell>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-rail">Your account is waiting for approval</h1>
      <p className="mt-3 text-sm text-muted">
        Thanks, {profile?.full_name}. A lab administrator needs to approve {profile?.email} before you can view the labs or book them.
        Check back later or ask the lab office.
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => refresh()}>Check again</Button>
        <Button variant="ghost" onClick={() => api.signOut()}>Sign out</Button>
      </div>
    </AuthShell>
  );
}
