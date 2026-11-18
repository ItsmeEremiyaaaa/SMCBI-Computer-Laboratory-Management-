import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { activeReservation, classesOn, manilaNow, shownStatus } from '../lib/seat';
import { effectiveStatuses, studentsInSection } from '../lib/rules';
import type { CheckIn, Pc, Reservation, ShownStatus, Student } from '../lib/types';

export type LivePc = Pc & { shown: ShownStatus; current?: Reservation };

// Live PC list for one lab (or all labs when labId is null): realtime PC changes,
// reservation changes, and a 30s tick so bookings start/end on time.
export function useLabLive(labId: string | null) {
  const [pcs, setPcs] = useState<Pc[]>([]);
  const [today, setToday] = useState<Reservation[]>([]);
  const [now, setNow] = useState(manilaNow);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Who is actually sitting where: class rosters (admin/staff only; empty for others) and QR check-ins.
  const [students, setStudents] = useState<Student[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  useEffect(() => { api.listStudents().then(setStudents).catch(() => {}); }, []);
  useEffect(() => { api.listCheckIns().then(setCheckIns).catch(() => {}); }, [now]);

  const loadRes = useCallback(async () => {
    const date = manilaNow().date;
    const [res, classes] = await Promise.all([api.listReservations({ status: 'approved', date }), api.listSchedules()]);
    setToday([...res, ...classesOn(date, classes)]);
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

  // New Manila day → load that day's bookings (screens are often left open overnight).
  useEffect(() => { loadRes().catch(() => {}); }, [now.date, loadRes]);

  const base: LivePc[] = pcs.map((pc) => ({
    ...pc, shown: shownStatus(pc, today, now), current: activeReservation(pc, today, now),
  }));
  // During a class only the seats with a student are In use (the rest are Free), per lab.
  const checkedIn = new Set(checkIns.map((c) => c.pc_id));
  const live = [...new Set(base.map((p) => p.lab_id))].flatMap((lab) => {
    const labPcs = base.filter((p) => p.lab_id === lab);
    const cls = labPcs.map((p) => p.current).find((r) => r && r.pc_id === null && (r.id.startsWith('class-') || /class/i.test(r.purpose)));
    if (!cls) return effectiveStatuses(labPcs, 'empty', null, checkedIn);
    const roster = cls.id.startsWith('class-') ? studentsInSection(students, cls.title.split(':')[0]).length : 0;
    return effectiveStatuses(labPcs, 'in_session', roster || null, checkedIn);
  });
  return { pcs: live, loading, error };
}
