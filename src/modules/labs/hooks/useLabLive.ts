import { useCallback, useEffect, useState } from 'react';
import { bookingsRepo } from '../../bookings/data/repository';
import { labsRepo } from '../data/repository';
import { peopleRepo } from '../../people/data/repository';
import { scheduleRepo } from '../../schedule/data/repository';
import { activeReservation, shownStatus } from '../logic/status';
import { classesOn } from '../../schedule/logic/rules';
import { manilaNow } from '../../../shared/time';
import { effectiveStatuses } from '../logic/status';
import { studentsInSection } from '../../people/logic/rules';
import type { CheckIn, Pc, Reservation, ShownStatus, Student } from '../../../shared/data/types';

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
  useEffect(() => { peopleRepo.listStudents().then(setStudents).catch(() => {}); }, []);
  useEffect(() => { labsRepo.listCheckIns().then(setCheckIns).catch(() => {}); }, [now]);

  const loadRes = useCallback(async () => {
    const date = manilaNow().date;
    const [res, classes] = await Promise.all([bookingsRepo.listReservations({ status: 'approved', date }), scheduleRepo.listSchedules()]);
    setToday([...res, ...classesOn(date, classes)]);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([labsRepo.listPcs(labId ?? undefined), loadRes()])
      .then(([p]) => { if (alive) { setPcs(p); setError(null); } })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    const offPc = labsRepo.subscribePcs(labId, (pc) => setPcs((list) => list.map((x) => (x.id === pc.id ? pc : x))));
    const offRes = bookingsRepo.subscribeReservations(() => { loadRes().catch(() => {}); });
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
