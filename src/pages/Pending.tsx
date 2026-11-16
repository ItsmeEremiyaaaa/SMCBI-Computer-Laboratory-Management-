import { api } from '../lib/api';
import { useAuth } from '../auth';
import { Button } from '../components/ui';
import AuthShell from './AuthShell';

export default function Pending() {
  const { profile } = useAuth();
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Your account is waiting for approval</h1>
      <p className="mt-3 text-sm text-muted">
        Thanks, {profile?.full_name}. A lab administrator needs to approve {profile?.email} before you can view the labs or book them.
        Check back later or ask the lab office.
      </p>
      <Button variant="ghost" className="mt-6" onClick={() => api.signOut()}>Sign out</Button>
    </AuthShell>
  );
}
