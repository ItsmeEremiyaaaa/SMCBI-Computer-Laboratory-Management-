import { Link } from 'react-router-dom';
import { CalendarClock, LogOut, MessageCircle, MonitorCheck, Plus, QrCode } from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { useLoad } from '../../../shared/hooks/useLoad';
import { bookingsRepo } from '../../bookings/data/repository';
import { labsRepo } from '../../labs/data/repository';
import { scheduleRepo } from '../../schedule/data/repository';
import { classesOn } from '../../schedule/logic/rules';
import { sectionOf } from '../../people/logic/rules';
import { manilaNow } from '../../../shared/time';
import { useMessages } from '../../messages/hooks/useMessages';
import { Button, Empty, fmtDate, fmtTime, PageHeader, Panel, ResBadge } from '../../../shared/ui/ui';

const LAB_NAME: Record<string, string> = { lab1: 'ComLab 1', lab2: 'ComLab 2', netlab: 'NetLab' };

// Home screen for student accounts: where am I sitting, my classes today, my NetLab bookings.
export default function StudentHome() {
  const { profile } = useAuth();
  const now = manilaNow();
  const pcs = useLoad(() => labsRepo.listPcs());
  const seat = useLoad(() => labsRepo.listCheckIns().then((rows) => rows.find((c) => c.user_id === profile?.id) ?? null));
  const schedules = useLoad(() => scheduleRepo.listSchedules());
  const bookings = useLoad(() => bookingsRepo.listReservations({ mine: true }));
  const { unread } = useMessages();

  const section = sectionOf(profile?.department ?? null, profile?.course ?? null);
  const today = classesOn(now.date, schedules.data ?? []).filter((c) => !section || c.title.startsWith(`${section}:`))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const upcoming = (bookings.data ?? []).filter((r) => r.date >= now.date).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  const pcLabel = (id: string | null) => pcs.data?.find((p) => p.id === id)?.label ?? id ?? '';

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Hi, ${profile?.full_name.split(' ')[0] ?? 'there'}`}
        sub={section ? `${section} · student` : 'Student account'}
        actions={
          <Link
            to="/messages"
            className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-chalk"
          >
            <MessageCircle size={16} className="text-accent" />
            <span>Messages</span>
            {unread > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-broken px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted"><MonitorCheck size={16} />Your seat</p>
          {seat.data ? (
            <>
              <p className="mt-2 font-cond text-3xl font-bold">{pcLabel(seat.data.pc_id)}</p>
              <p className="text-sm text-muted">{LAB_NAME[seat.data.lab_id] ?? seat.data.lab_id}, since {new Date(seat.data.checked_in_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</p>
              <Button variant="ghost" size="sm" className="mt-3" onClick={async () => { await labsRepo.checkOut(); await seat.reload(); }}>
                <LogOut size={14} />Leave seat
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-lg font-semibold">Not checked in</p>
              <p className="mt-1 flex items-start gap-2 text-sm text-muted"><QrCode size={28} className="shrink-0 text-accent" />
                At your PC, scan the QR code on the sticker with your phone camera and tap “I'm sitting at…”.</p>
            </>
          )}
        </Panel>

        <Panel className="p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted"><CalendarClock size={16} />{section ? `${section} lab classes today` : 'Lab classes today · all sections'}</p>
          {!section && <p className="mt-1 text-xs text-muted">Your account isn't linked to a student record yet, so every class is shown. Ask the lab office to add your record.</p>}
          {today.length === 0 ? <p className="mt-2 text-sm text-muted">No lab classes today.</p> : (
            <ul className="mt-2 grid gap-2">
              {today.map((c) => (
                <li key={c.id} className="rounded-lg bg-chalk px-3 py-2 text-sm">
                  <p className="font-semibold">{c.title.split(': ').slice(1).join(': ')}</p>
                  <p className="text-muted">{fmtTime(c.start_time)}–{fmtTime(c.end_time)} · {LAB_NAME[c.lab_id] ?? c.lab_id} · {c.requester_name}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="font-semibold">My NetLab bookings</h2>
          <Link to="/reservations?new=1&lab=netlab" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:bg-rail">
            <Plus size={16} />Book a NetLab PC
          </Link>
        </div>
        {upcoming.length === 0 ? <Empty>{bookings.loading ? 'Loading…' : 'No upcoming bookings. The admin approves or denies each request.'}</Empty> : (
          <ul className="divide-y divide-line">
            {upcoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-muted">{fmtDate(r.date)}, {fmtTime(r.start_time)}–{fmtTime(r.end_time)} · {pcLabel(r.pc_id)}</p>
                  {r.admin_notes && <p className="text-muted">Admin: {r.admin_notes}</p>}
                </div>
                <ResBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
