import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { activeReservation, manilaNow, shownStatus } from '../lib/seat';
import type { Pc, Reservation, ShownStatus } from '../lib/types';

export type LivePc = Pc & { shown: ShownStatus; current?: Reservation };

// Live PC list for one lab (or all labs when labId is null): realtime PC changes,
// reservation changes, and a 30s tick so bookings start/end on time.
export function useLabLive(labId: string | null) {
  const [pcs, setPcs] = useState<Pc[]>([]);
  const [today, setToday] = useState<Reservation[]>([]);
  const [now, setNow] = useState(manilaNow);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRes = useCallback(async () => {
    setToday(await api.listReservations({ status: 'approved', date: manilaNow().date }));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.listPcs(labId ?? undefined), loadRes()])
      .then(([p]) => { if (alive) { setPcs(p); setError(null); } })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    const offPc = api.subscribePcs(labId, (pc) => setPcs((list) => list.map((x) => (x.id === pc.id ? pc : x))));
    const offRes = api.subscribeReservations(() => { loadRes().catch(() => {}); });
    const t = setInterval(() => setNow(manilaNow()), 30_000);
    return () => { alive = false; offPc(); offRes(); clearInterval(t); };
  }, [labId, loadRes]);

  const live: LivePc[] = pcs.map((pc) => ({
    ...pc, shown: shownStatus(pc, today, now), current: activeReservation(pc, today, now),
  }));
  return { pcs: live, loading, error };
}
