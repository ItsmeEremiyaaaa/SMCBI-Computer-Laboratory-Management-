import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, LogOut, MonitorCheck } from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { useLoad } from '../../../shared/hooks/useLoad';
import { bookingsRepo } from '../../bookings/data/repository';
import { labsRepo } from '../data/repository';
import { scheduleRepo } from '../../schedule/data/repository';
import { checkInProblem } from '../logic/status';
import { manilaNow } from '../../../shared/time';
import type { CheckIn as CheckInRow } from '../../../shared/data/types';
import { Alert, Button, Panel } from '../../../shared/ui/ui';
import ReportProblem from '../../reports/ui/ReportProblem';

const LAB_NAME: Record<string, string> = { lab1: 'Computer Laboratory 1', lab2: 'Computer Laboratory 2', netlab: 'Networking Laboratory' };

// Opened by scanning the QR code stuck on a PC: the student confirms they are sitting there.
// (Later the PC itself can open this page after the student signs in on it.)
export default function CheckIn() {
  const { pcId = '' } = useParams();
  const { profile } = useAuth();
  const pcs = useLoad(() => labsRepo.listPcs());
  const schedules = useLoad(() => scheduleRepo.listSchedules());
  const mine = useLoad(() => bookingsRepo.listReservations({ mine: true, status: 'approved' }));
  const active = useLoad(() => labsRepo.listCheckIns());
  const [done, setDone] = useState<CheckInRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pc = pcs.data?.find((p) => p.id === pcId);
  const loading = pcs.loading || schedules.loading || mine.loading || active.loading;
  const myRow = (active.data ?? []).find((c) => c.user_id === profile?.id);
  const here = (active.data ?? []).find((c) => c.pc_id === pcId);
  const problem = pc && profile && !done
    ? checkInProblem(pc, { role: profile.role, userId: profile.id, now: manilaNow(), schedules: schedules.data ?? [],
        reservations: mine.data ?? [], checkIns: active.data ?? [] })
    : null;

  async function confirm() {
    setBusy(true); setError(null);
    try { setDone(await labsRepo.checkIn(pcId)); await active.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function leave() {
    setBusy(true); setError(null);
    try { await labsRepo.checkOut(); setDone(null); await active.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const atThisPc = done?.pc_id === pcId || myRow?.pc_id === pcId;
  return (
    <div className="mx-auto grid max-w-md gap-4 p-4 pt-8 sm:pt-12">
      <Panel className="overflow-hidden">
        <div className="navy-weave px-5 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">{pc ? LAB_NAME[pc.lab_id] ?? pc.lab_id : 'Check in'}</p>
          <h1 className="mt-1 flex items-center gap-2 font-cond text-4xl font-bold"><MonitorCheck size={30} />{pc?.label ?? (loading ? '…' : 'Unknown PC')}</h1>
        </div>
        <div className="grid gap-4 p-5">
          {!loading && !pc && <Alert>This QR code doesn't match a PC. Ask the lab staff for help.</Alert>}
          {error && <Alert>{error}</Alert>}

          {pc && profile?.role === 'student' && (atThisPc ? (
            <>
              <p className="flex items-center gap-2 text-lg font-semibold text-emerald-700"><CheckCircle2 size={22} />You're checked in here</p>
              <p className="text-sm text-muted">Signed in as {profile.full_name}. Leave the seat when you're done so the next student can use it.</p>
              <Button variant="ghost" disabled={busy} onClick={leave}><LogOut size={16} />Leave this seat</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Signed in as <b className="text-ink">{profile.full_name}</b>.
                {myRow && <> You're currently checked in at another PC; confirming here moves you.</>}</p>
              {problem && <Alert>{problem}</Alert>}
              <Button disabled={busy || loading || !!problem} onClick={confirm} className="h-12 text-base">
                {busy ? 'Checking in…' : `I'm sitting at ${pc.label}`}
              </Button>
            </>
          ))}

          {pc && profile && profile.role !== 'student' && (
            <p className="text-sm">{here ? <>Checked in now: <b>{here.user_name}</b></> : <span className="text-muted">No student is checked in at this PC.</span>}</p>
          )}
          {pc && profile && profile.role !== 'admin' && profile.role !== 'staff' && pc.status !== 'broken' && (
            <ReportProblem pcId={pc.id} pcLabel={pc.label} />
          )}
        </div>
      </Panel>
      <Link to="/" className="text-center text-sm font-medium text-accent hover:underline">Back to home</Link>
    </div>
  );
}
