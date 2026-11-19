import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { useLoad } from '../../../shared/hooks/useLoad';
import { bookingsRepo } from '../data/repository';
import { labsRepo } from '../../labs/data/repository';
import { scheduleRepo } from '../../schedule/data/repository';
import { useCleared } from '../../../shared/hooks/useCleared';
import { manilaNow } from '../../../shared/time';
import type { Reservation, ResStatus } from '../../../shared/data/types';
import ReservationForm from './ReservationForm';
import { Alert, Button, Empty, Field, fmtDate, fmtTime, Input, Modal, PageHeader, Panel, ResBadge, Select, Textarea, askConfirm, toast } from '../../../shared/ui/ui';

const STATUSES: ResStatus[] = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];

export default function Reservations() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'student'; // sees only their own requests
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as ResStatus | '';
  const [labId, setLabId] = useState('');
  const [date, setDate] = useState('');
  const [details, setDetails] = useState<Reservation | null>(null);
  const [review, setReview] = useState<{ r: Reservation; to: 'approved' | 'rejected' | 'cancelled' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labs = useLoad(() => labsRepo.listLabs());
  const pcs = useLoad(() => labsRepo.listPcs());
  const fetched = useLoad(() => bookingsRepo.listReservations({ mine: isTeacher }), [isTeacher]);
  // a requester's "delete" on a decided booking only hides it from their own list; the admin keeps the record
  const { cleared: hidden, clear: hide } = useCleared(profile?.id);
  const list = { ...fetched, data: fetched.data?.filter((r) => isAdmin || !hidden.has(`res-${r.id}`)) };
  // ?review=<id>&to=approved|rejected (from the bell / Notifications) opens that booking's review dialog
  const reviewId = params.get('review'), reviewTo = params.get('to');
  useEffect(() => {
    if (!reviewId || !list.data) return;
    const r = list.data.find((x) => x.id === reviewId);
    if (r && r.status === 'pending' && (reviewTo === 'approved' || reviewTo === 'rejected')) setReview({ r, to: reviewTo });
    params.delete('review'); params.delete('to'); setParams(params, { replace: true });
  }, [reviewId, reviewTo, list.data, params, setParams]);
  const approvedAll = useLoad(() => bookingsRepo.listReservations({ status: 'approved' }));
  const schedules = useLoad(() => scheduleRepo.listSchedules());
  const isStudent = profile?.role === 'student';
  const brokenPc = (id: string | null) => !!id && pcs.data?.find((p) => p.id === id)?.status === 'broken';
  useEffect(() => bookingsRepo.subscribeReservations(list.reload), [list.reload]);

  const labName = (id: string) => {
    const l = labs.data?.find((x) => x.id === id);
    if (!l) return id;
    if (l.id === 'lab1' || l.name.includes('1')) return 'Computer Laboratory 1';
    if (l.id === 'lab2' || l.name.includes('2')) return 'Computer Laboratory 2';
    if (l.id === 'netlab' || l.name.toLowerCase().includes('net')) return 'Networking Laboratory';
    return l.name;
  };
  const pcLabel = (id: string | null) => (id ? pcs.data?.find((p) => p.id === id)?.label ?? id : 'Whole lab');
  const rows = (list.data ?? []).filter((r) => (!status || r.status === status) && (!labId || r.lab_id === labId) && (!date || r.date === date));
  const now = manilaNow();
  const ended = (r: Reservation) => r.date < now.date || (r.date === now.date && r.end_time <= now.time);

  const newOpen = params.get('new') === '1';
  const closeNew = () => { params.delete('new'); params.delete('lab'); params.delete('pc'); setParams(params, { replace: true }); };
  const setStatus = (s: string) => { if (s) params.set('status', s); else params.delete('status'); setParams(params, { replace: true }); };

  async function act(fn: () => Promise<void>) {
    setError(null);
    try { await fn(); await list.reload(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <PageHeader title="Reservations"
        sub={isStudent ? 'Book a Networking Laboratory PC. The admin approves or denies each request.'
          : isTeacher ? 'Your lab and PC requests.' : 'Requests from teachers and students for whole labs or single PCs.'}
        actions={<Button onClick={() => { params.set('new', '1'); setParams(params); }}><Plus size={16} />{isStudent ? 'Book a NetLab PC' : 'Request a lab'}</Button>} />

      <Panel className="mb-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-5">
          {STATUSES.map((s) => {
            const n = (list.data ?? []).filter((r) => r.status === s).length;
            return (
              <button key={s} onClick={() => setStatus(status === s ? '' : s)} aria-pressed={status === s}
                className={`bg-panel px-4 py-3 text-left transition-colors hover:bg-chalk ${status === s ? 'shadow-[inset_0_-3px_0_var(--color-accent)]' : ''}`}>
                <p className="text-sm capitalize text-muted">{s}</p>
                <p className="font-cond text-2xl font-semibold">{n}</p>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Lab">
          <Select value={labId} onChange={(e) => setLabId(e.target.value)} className="w-56">
            <option value="">All labs</option>
            {labs.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        <Field label="Day"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" /></Field>
        {(labId || date || status) && <Button variant="quiet" onClick={() => { setLabId(''); setDate(''); setStatus(''); }}>Clear filters</Button>}
      </div>

      {(error || list.error) && <div className="mb-4"><Alert>{error || list.error}</Alert></div>}

      <Panel>
        {rows.length === 0 ? (
          <Empty>{list.loading ? 'Loading…' : 'No reservations match. Use “Request a lab” to book one.'}</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="grid gap-3 px-4 py-3 xl:grid-cols-[8.5rem_minmax(12rem,1fr)_8rem_6rem_auto] xl:items-center">
                <div className="text-sm">
                  <p className="font-medium">{fmtDate(r.date)}</p>
                  <p className="text-muted">{fmtTime(r.start_time)} to {fmtTime(r.end_time)}</p>
                </div>
                <div className="min-w-0">
                  <button type="button" onClick={() => setDetails(r)} className="max-w-full truncate text-left font-medium text-ink hover:text-accent hover:underline">{r.title}</button>
                  <p className="truncate text-sm text-muted">
                    {!isTeacher && <>{r.requester_name}. </>}{r.purpose}{r.participants ? `, ${r.participants} people` : ''}
                  </p>
                  {(r.section || r.requirements) && <p className="truncate text-xs text-muted">{[r.section && `For ${r.section}`, r.requirements].filter(Boolean).join(' · ')}</p>}
                  {r.admin_notes && <p className="truncate text-sm text-muted">Admin note: {r.admin_notes.replace(/\s+/g, ' ')}</p>}
                </div>
                <p className="text-sm">{labName(r.lab_id)}<span className="block text-muted">{pcLabel(r.pc_id)}</span>
                  {r.status === 'pending' && brokenPc(r.pc_id) && <span className="block text-xs font-semibold text-red-700">PC is broken — can't approve</span>}</p>
                <div><ResBadge status={r.status} /></div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {isAdmin && r.status === 'pending' && <>
                    <Button size="sm" onClick={() => setReview({ r, to: 'approved' })}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => setReview({ r, to: 'rejected' })}>Reject</Button>
                  </>}
                  {isAdmin && r.status === 'approved' && !ended(r) &&
                    <Button size="sm" variant="ghost" onClick={() => setReview({ r, to: 'cancelled' })}>Cancel booking</Button>}
                  {isAdmin && r.status === 'approved' && ended(r) &&
                    <Button size="sm" variant="ghost" onClick={() => act(() => bookingsRepo.reviewReservation(r.id, 'completed'))}>Mark completed</Button>}
                  {/* admin: archive. requester: cancel a pending request, or hide a decided one from their own list */}
                  {(isAdmin || (r.status !== 'approved' && r.requester_id === profile?.id)) && (
                    <button type="button" title="Delete" aria-label={`Delete ${r.title}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        const own = !isAdmin && r.status !== 'pending';
                        askConfirm(own
                          ? { title: 'Remove from your list?', message: 'It disappears from your reservations. The lab office keeps its record.', confirmLabel: 'Remove', danger: true }
                          : isAdmin
                            ? { title: 'Delete this booking?', message: 'It moves to the Archive, where you can restore it.', confirmLabel: 'Delete', danger: true }
                            : { title: 'Cancel this request?', message: 'The admin will no longer see it.', confirmLabel: 'Cancel request', danger: true })
                          .then((ok) => { if (!ok) return; if (own) hide([`res-${r.id}`]); else void act(() => bookingsRepo.deleteReservation(r.id)); });
                      }}><Trash2 size={16} /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal wide open={newOpen} title={isStudent ? 'Book a NetLab PC' : 'Request a lab'} onClose={closeNew}>
        {labs.data && profile && (
          <ReservationForm labs={labs.data} pcs={pcs.data ?? []} role={profile.role}
            approved={approvedAll.data ?? []} schedules={schedules.data ?? []}
            initial={{ lab_id: params.get('lab') ?? undefined, pc_id: params.get('pc') ?? undefined }}
            onCancel={closeNew}
            onSubmit={async (input) => { await bookingsRepo.createReservation(input); closeNew(); await list.reload(); await approvedAll.reload(); }} />
        )}
      </Modal>

      {details && (
        <Modal open title={details.title} onClose={() => setDetails(null)}>
          <BookingDetails r={details} where={`${labName(details.lab_id)}, ${pcLabel(details.pc_id)}`} />
        </Modal>
      )}
      {review && (
        <ReviewModal r={review.r} to={review.to} where={`${labName(review.r.lab_id)}, ${pcLabel(review.r.pc_id)}`}
          onClose={() => setReview(null)}
          onDone={async () => { setReview(null); await list.reload(); await approvedAll.reload(); }} />
      )}
    </>
  );
}

// Everything about one booking, for the admin (and the requester) to read before deciding.
function BookingDetails({ r, where }: { r: Reservation; where: string }) {
  const rows: [string, React.ReactNode][] = [
    ['Status', <ResBadge status={r.status} />],
    ['Requested by', r.requester_name],
    ['When', `${fmtDate(r.date)}, ${fmtTime(r.start_time)} to ${fmtTime(r.end_time)}`],
    ['Where', where],
    ['For class', r.section || '—'],
    ['Participants', r.participants ?? '—'],
    ['Requirements', r.requirements || '—'],
    ['Purpose', r.purpose],
    ...(r.created_at ? [['Sent', new Date(r.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })] as [string, string]] : []),
    ...(r.admin_notes ? [['Admin note', <span className="whitespace-pre-line">{r.admin_notes}</span>] as [string, React.ReactNode]] : []),
  ];
  return (
    <dl className="grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[9rem_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted sm:pt-0.5">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// The school greeting every note starts with; a note left as just the greeting is sent as no note.
const GREETING = 'Good Day!\nPraised Be Jesus and Mary!\n\n';

function ReviewModal({ r, to, where, onClose, onDone }:
  { r: Reservation; to: 'approved' | 'rejected' | 'cancelled'; where: string; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState(GREETING);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verb = to === 'approved' ? 'Approve' : to === 'rejected' ? 'Reject' : 'Cancel booking';
  async function go() {
    setBusy(true); setError(null);
    try {
      await bookingsRepo.reviewReservation(r.id, to, notes.trim() === GREETING.trim() ? null : notes.trim() || null);
      toast(to === 'approved' ? 'Booking approved' : to === 'rejected' ? 'Booking rejected' : 'Booking cancelled', `${r.title} · ${r.requester_name} is notified`);
      onDone();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal wide open title={to === 'cancelled' ? 'Cancel this approved booking?' : `${verb} request`} onClose={onClose}>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {/* landscape on laptops: the booking on the left, the note and the decision on the right */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        <div className="rounded-lg border border-line bg-chalk/50 p-3">
          <p className="mb-2 font-semibold">{r.title}</p>
          <BookingDetails r={r} where={where} />
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Note to the requester (optional)" hint="Starts with the school greeting. Type your message below it, or leave it as is to send no note.">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} data-autofocus
              onFocus={(e) => { const end = e.currentTarget.value.length; e.currentTarget.setSelectionRange(end, end); }} />
          </Field>
          <div className="mt-auto flex justify-end gap-2">
            <Button variant={to === 'approved' ? 'primary' : 'danger'} disabled={busy} onClick={go}>{verb}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
