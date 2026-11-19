import { useAuth } from '../../auth/hooks/auth';
import { AttentionList } from './NotificationBell';
import { StudentNotesList } from './StudentBell';
import { PageHeader } from '../../../shared/ui/ui';

// All notifications in one place (not per lab): accounts, problem reports, booking requests, broken PCs.
// Updates live; each item opens where it is handled; Clear removes it from this list.
export default function Inbox() {
  const { profile } = useAuth();
  const staff = profile?.role === 'admin' || profile?.role === 'staff';
  return (
    <div className="grid gap-5">
      <PageHeader title="Notifications" sub={staff ? 'Everything that needs attention across the labs, updated live.' : "Your bookings, reports and today's reminders."} />
      <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
        {staff ? <AttentionList page /> : <StudentNotesList page />}
      </div>
    </div>
  );
}
