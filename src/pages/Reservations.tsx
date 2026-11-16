import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../auth';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import { manilaNow } from '../lib/seat';
import type { Reservation, ResStatus } from '../lib/types';
import ReservationForm from '../components/ReservationForm';
import { Alert, Button, Empty, Field, fmtDate, fmtTime, Input, Modal, PageHeader, Panel, ResBadge, Select, Textarea } from '../components/ui';

const STATUSES: ResStatus[] = ['pending', 'approved', 'rejected', 'completed'];

export default function Reservations() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as ResStatus | '';
  const [labId, setLabId] = useState('');
  const [date, setDate] = useState('');
  const [review, setReview] = useState<{ r: Reservation; to: 'approved' | 'rejected' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labs = useLoad(() => api.listLabs());
  const pcs = useLoad(() => api.listPcs());
  const list = useLoad(() => api.listReservations({ mine: isTeacher }), [isTeacher]);
  useEffect(() => api.subscribeReservations(list.reload), [list.reload]);

  const labName = (id: string) => labs.data?.find((l) => l.id === id)?.name.replace('Computer Laboratory', 'Lab') ?? id;
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
        sub={isTeacher ? 'Your lab and PC requests.' : 'Requests from teachers for whole labs or single PCs.'}
        actions={<Button onClick={() => { params.set('new', '1'); setParams(params); }}><Plus size={16} />Request a lab</Button>} />

      <Panel className="mb-4">
        <div className="grid gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-4">
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
              <li key={r.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[8.5rem_minmax(12rem,1fr)_8rem_6rem_auto] lg:items-center">
                <div className="text-sm">
                  <p className="font-medium">{fmtDate(r.date)}</p>
                  <p className="text-muted">{fmtTime(r.start_time)} to {fmtTime(r.end_time)}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="truncate text-sm text-muted">
                    {!isTeacher && <>{r.requester_name}. </>}{r.purpose}{r.participants ? `, ${r.participants} people` : ''}
                  </p>
                  {r.admin_notes && <p className="text-sm text-muted">Admin note: {r.admin_notes}</p>}
                </div>
                <p className="text-sm">{labName(r.lab_id)}<span className="block text-muted">{pcLabel(r.pc_id)}</span></p>
                <div><ResBadge status={r.status} /></div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {isAdmin && r.status === 'pending' && <>
                    <Button size="sm" onClick={() => setReview({ r, to: 'approved' })}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => setReview({ r, to: 'rejected' })}>Reject</Button>
                  </>}
                  {isAdmin && r.status === 'approved' && ended(r) &&
                    <Button size="sm" variant="ghost" onClick={() => act(() => api.reviewReservation(r.id, 'completed'))}>Mark completed</Button>}
                  {r.status === 'pending' && (isAdmin || r.requester_id === profile?.id) &&
                    <Button size="sm" variant="quiet" onClick={() => confirm('Delete this request?') && act(() => api.deleteReservation(r.id))}>Delete</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal open={newOpen} title="Request a lab" onClose={closeNew}>
        {labs.data && (
          <ReservationForm labs={labs.data} pcs={pcs.data ?? []}
            initial={{ lab_id: params.get('lab') ?? undefined, pc_id: params.get('pc') ?? undefined }}
            onCancel={closeNew}
            onSubmit={async (input) => { await api.createReservation(input); closeNew(); await list.reload(); }} />
        )}
      </Modal>

      {review && (
        <ReviewModal r={review.r} to={review.to} where={`${labName(review.r.lab_id)}, ${pcLabel(review.r.pc_id)}`}
          onClose={() => setReview(null)}
          onDone={async () => { setReview(null); await list.reload(); }} />
      )}
    </>
  );
}

function ReviewModal({ r, to, where, onClose, onDone }:
  { r: Reservation; to: 'approved' | 'rejected'; where: string; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verb = to === 'approved' ? 'Approve' : 'Reject';
  async function go() {
    setBusy(true); setError(null);
    try { await api.reviewReservation(r.id, to, notes.trim() || null); onDone(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open title={`${verb} request`} onClose={onClose}>
      <div className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <div className="text-sm">
          <p className="font-medium">{r.title}</p>
          <p className="text-muted">{r.requester_name}, {where}</p>
          <p className="text-muted">{fmtDate(r.date)}, {fmtTime(r.start_time)} to {fmtTime(r.end_time)}</p>
        </div>
        <Field label="Note to the teacher (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={to === 'approved' ? 'primary' : 'danger'} disabled={busy} onClick={go}>{verb}</Button>
        </div>
      </div>
    </Modal>
  );
}
