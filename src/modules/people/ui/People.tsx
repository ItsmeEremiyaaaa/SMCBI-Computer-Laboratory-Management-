import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Plus, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { useLoad } from '../../../shared/hooks/useLoad';
import { type StudentInput } from '../../../shared/data/api';
import { peopleRepo } from '../data/repository';
import { scheduleRepo } from '../../schedule/data/repository';
import { DEPARTMENTS, SEXES, STUDENT_STATUSES, YEAR_LEVELS, type ClassSchedule, type Profile, type Role, type Student, type StudentStatus } from '../../../shared/data/types';
import { validateStudent } from '../logic/rules';
import { nameKey } from '../logic/rules';
import { Alert, Button, Empty, Field, Input, Modal, PageHeader, Panel, Select, askConfirm, toast } from '../../../shared/ui/ui';

const TABS = [
  { id: 'teachers', label: 'Teachers' },
  { id: 'staff', label: 'Staff' },
  { id: 'accounts', label: 'Student accounts' },
  { id: 'students', label: 'Student records' },
] as const;

export default function People() {
  const { tab = 'teachers' } = useParams();
  const [q, setQ] = useState('');
  return (
    <>
      <PageHeader title="People" sub="Accounts that can sign in, and the student records." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav className="flex rounded-lg border border-line bg-panel p-1" aria-label="People type">
          {TABS.map((t) => (
            <NavLink key={t.id} to={`/people/${t.id}`}
              className={({ isActive }) => `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <label className="relative ml-auto w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-3 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search" className="pl-9" />
        </label>
      </div>
      {tab === 'students' ? <Students q={q} />
        : <Accounts role={tab === 'staff' ? 'staff' : tab === 'accounts' ? 'student' : 'teacher'} q={q} />}
    </>
  );
}

const match = (q: string, ...fields: (string | null)[]) => !q || fields.some((f) => f?.toLowerCase().includes(q.toLowerCase()));

export { nameKey };

const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LAB_SHORT: Record<string, string> = { lab1: 'ComLab 1', lab2: 'ComLab 2', netlab: 'NetLab' };

function ClassList({ classes }: { classes: ClassSchedule[] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {classes.map((c) => (
        <li key={c.id} title={`${c.subject} · ${LAB_SHORT[c.lab_id] ?? c.lab_id}`}
          className="rounded-md bg-chalk px-1.5 py-0.5 text-[11px] text-muted">
          <b className="font-semibold text-ink">{c.section}</b> {c.subject.split(' ')[0]} · {DAY_SHORT[c.day_of_week]} {c.start_time.slice(0, 5)} · {LAB_SHORT[c.lab_id] ?? c.lab_id}
        </li>
      ))}
    </ul>
  );
}

function Accounts({ role, q }: { role: Role; q: string }) {
  const { profile: me } = useAuth();
  const list = useLoad(() => peopleRepo.listProfiles(role), [role]);
  const [edit, setEdit] = useState<Profile | null>(null);
  const [open, setOpen] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = (list.data ?? []).filter((p) => !p.archived_at && match(q, p.full_name, p.email, p.department))
    .sort((a, b) => Number(a.approved) - Number(b.approved) || a.full_name.localeCompare(b.full_name));

  // Instructors named on the class schedule, matched to accounts by name.
  const schedules = useLoad(() => (role === 'teacher' ? scheduleRepo.listSchedules() : Promise.resolve([])), [role]);
  const byInstructor = new Map<string, { name: string; classes: ClassSchedule[] }>();
  for (const c of [...(schedules.data ?? [])].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))) {
    const k = nameKey(c.instructor);
    if (!k) continue;
    const e = byInstructor.get(k) ?? { name: c.instructor, classes: [] };
    e.classes.push(c);
    byInstructor.set(k, e);
  }
  // Student accounts: the student record with the same email (sign-ups only auto-approve when one exists).
  const records = useLoad(() => (role === 'student' ? peopleRepo.listStudents() : Promise.resolve([] as Student[])), [role]);
  const recordOf = (p: Profile) => records.data?.find((s) => s.email.toLowerCase() === p.email.toLowerCase());
  const [newRecord, setNewRecord] = useState<StudentInput | null>(null);
  const draftRecord = (p: Profile): StudentInput => {
    const id = p.email.split('@')[0].toUpperCase();
    return { ...blank, student_id: /^C\d{6}$/.test(id) ? id : '', full_name: p.full_name, email: p.email };
  };

  const accountKeys = new Set((list.data ?? []).map((p) => nameKey(p.full_name)));
  const noAccount = [...byInstructor.entries()].filter(([k, v]) => !accountKeys.has(k) && match(q, v.name))
    .map(([, v]) => v).sort((a, b) => a.name.localeCompare(b.name));

  async function archive(id: string) {
    setError(null);
    try { await peopleRepo.setAccountArchived(id, true); await list.reload(); } catch (e) { setError((e as Error).message); }
  }

  async function patch(id: string, p: Partial<Profile>) {
    setError(null);
    try { await peopleRepo.updateProfile(id, p); await list.reload(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <Panel>
        {role === 'staff' && (
          <p className="border-b border-line px-4 py-3 text-sm text-muted">
            To add staff, have them sign up, then open their account under Teachers and change the role to Staff.
          </p>
        )}
        {role === 'student' && (
          <p className="border-b border-line px-4 py-3 text-sm text-muted">
            Students who sign up with an email that matches a student record are approved automatically. The ones below waiting for
            approval have no matching record. Add the record (or fix its email) and approve them.
          </p>
        )}
        {rows.length === 0 ? <Empty>{list.loading ? 'Loading…' : `No ${role === 'staff' ? 'staff' : role === 'student' ? 'student accounts' : 'teachers'} found.`}</Empty> : (
          <ul className="divide-y divide-line">
            {rows.map((p) => {
              const rec = role === 'student' && !records.loading ? recordOf(p) : undefined;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpen(p)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-chalk">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                      {p.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{p.full_name}</span>
                      <span className="block truncate text-sm text-muted">{p.email}{p.department && `, ${p.department}`}{p.course && `, ${p.course}`}</span>
                    </span>
                    {!p.approved && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">Waiting for approval</span>}
                    {role === 'student' && !records.loading && !rec && <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 ring-inset">No student record</span>}
                    {byInstructor.get(nameKey(p.full_name)) && <span className="soft-chip text-xs text-muted">{byInstructor.get(nameKey(p.full_name))!.classes.length} classes</span>}
                    <ChevronRight size={16} className="text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {role === 'teacher' && noAccount.length > 0 && (
        <Panel className="mt-4">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-semibold">On the class schedule ({noAccount.length})</h2>
            <p className="text-sm text-muted">These instructors teach in the labs but haven't signed up yet. Once they sign up with their @smcbi.edu.ph email under the same name, they appear above with their classes, ready to approve.</p>
          </div>
          <ul className="divide-y divide-line">
            {noAccount.map((t) => (
              <li key={t.name} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chalk text-sm font-semibold text-muted">
                  {nameKey(t.name).split(' ').map((w) => w[0].toUpperCase()).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted">{t.classes.length} lab class{t.classes.length > 1 ? 'es' : ''} a week</p>
                  <ClassList classes={t.classes} />
                </div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 ring-inset">No account yet</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {open && (() => {
        const p = rows.find((x) => x.id === open.id) ?? open;
        const rec = role === 'student' ? recordOf(p) : undefined;
        const classes = byInstructor.get(nameKey(p.full_name))?.classes;
        const facts: [string, ReactNode][] = [
          ['Email', p.email], ['Role', <span className="capitalize">{p.role}</span>], ['Department', p.department ?? '—'],
          [p.role === 'student' ? 'Year and section' : 'Course taught', p.course ?? '—'], ['Phone', p.phone ?? '—'],
          ...(role === 'student' ? [['Student record', rec ? `${rec.student_id} · ${rec.course} ${rec.year_level} ${rec.section}` : <span className="font-medium text-red-700">None with this email</span>] as [string, ReactNode]] : []),
        ];
        return (
          <Modal open wide title={p.full_name} onClose={() => setOpen(null)}>
            <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-lg font-bold text-white">{p.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <div>
                    <p className="text-lg font-semibold text-ink">{p.full_name}</p>
                    {p.approved ? <span className="text-xs font-medium text-emerald-700">Approved account</span> : <span className="text-xs font-medium text-amber-700">Waiting for approval</span>}
                  </div>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
                  {facts.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="break-words font-medium text-ink">{v}</dd></div>))}
                </dl>
                {classes && <div className="mt-4"><p className="text-sm font-medium text-ink">Lab classes</p><ClassList classes={classes} /></div>}
              </div>
              <div className="grid content-start gap-2 lg:w-52">
                {!p.approved && <Button onClick={() => { void patch(p.id, { approved: true }); toast(`${p.full_name} approved`); }}>Approve</Button>}
                <Button variant="ghost" onClick={() => { setOpen(null); setEdit(p); }}>Edit account</Button>
                {role === 'student' && <Button variant="ghost" onClick={() => { setOpen(null); setNewRecord(rec ?? draftRecord(p)); }}>{rec ? 'Edit student record' : 'Add student record'}</Button>}
                {p.approved && p.id !== me?.id && (
                  <Button variant="quiet" className="text-red-700" onClick={() => askConfirm({ title: `Archive ${p.full_name}?`, message: 'They lose access right away. You can restore them from the Archive.', confirmLabel: 'Archive', danger: true })
                    .then((ok) => { if (ok) { setOpen(null); void archive(p.id); toast(`${p.full_name} archived`); } })}>Archive account</Button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}
      {newRecord && <StudentModal s={newRecord} onClose={() => setNewRecord(null)}
        onSave={async (x) => { await saveRecordKeepingLogin(x, newRecord, list.data ?? []); setNewRecord(null); await records.reload(); await list.reload(); }} />}
      {edit && <ProfileModal p={edit} canChangeRole={edit.id !== me?.id} onClose={() => setEdit(null)}
        onSave={async (x) => { await peopleRepo.updateProfile(edit.id, x); setEdit(null); await list.reload(); }} />}
    </>
  );
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th'];
/** 'Nth Year X' options for a department, from student records and timetable sections like 'BSIT 2B'; keeps the current value. */
export function yearSections(department: string, records: Student[], timetable: ClassSchedule[], current = '') {
  const out = new Set<string>();
  for (const r of records) if (r.course === department && r.year_level && r.section) out.add(`${r.year_level} ${r.section.toUpperCase()}`);
  for (const c of timetable) {
    const m = c.section.trim().match(/^([A-Z]+)\s*(\d)\s*([A-Z])$/i);
    if (m && m[1].toUpperCase() === department) out.add(`${ORDINAL[Number(m[2])] ?? m[2] + 'th'} Year ${m[3].toUpperCase()}`);
  }
  if (current) out.add(current);
  return [...out].sort();
}

function ProfileModal({ p, canChangeRole, onClose, onSave }:
  { p: Profile; canChangeRole: boolean; onClose: () => void; onSave: (x: Partial<Profile>) => Promise<void> }) {
  const [f, setF] = useState({ full_name: p.full_name, email: p.email, department: p.department ?? '', course: p.course ?? '', phone: p.phone ?? '', address: p.address ?? '', role: p.role });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const isStudent = f.role === 'student';
  // year & section choices: the sections on record for this department (student records + lab timetable)
  const records = useLoad(() => (isStudent ? peopleRepo.listStudents().catch(() => []) : Promise.resolve([] as Student[])), [isStudent]);
  const timetable = useLoad(() => (isStudent ? scheduleRepo.listSchedules().catch(() => []) : Promise.resolve([] as ClassSchedule[])), [isStudent]);
  const sections = useMemo(() => yearSections(f.department, records.data ?? [], timetable.data ?? [], f.course), [f.department, f.course, records.data, timetable.data]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.full_name.trim()) return setError('Full name is required.');
    if (f.phone && !/^\d{11}$/.test(f.phone)) return setError('Phone must be 11 digits, e.g. 09171234567.');
    const email = f.email.trim().toLowerCase();
    if (canChangeRole && email !== p.email.toLowerCase() && !/^[^\s@]+@smcbi\.edu\.ph$/.test(email)) return setError('Use an @smcbi.edu.ph email.');
    try {
      // the login email changes first: if it's taken, nothing else is saved
      if (canChangeRole && email !== p.email.toLowerCase()) await peopleRepo.updateAccountEmail(p.id, email);
      await onSave({ full_name: f.full_name.trim(), department: f.department || null, course: f.course || null,
        phone: f.phone || null, address: f.address || null, ...(canChangeRole ? { role: f.role } : {}) });
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal open title={`Edit ${p.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Full name"><Input value={f.full_name} onChange={set('full_name')} /></Field>
        <Field label="Email" hint={canChangeRole ? 'This is the sign-in email. Changing it also updates the matching student record.' : "You can't change your own sign-in email here."}>
          <Input type="email" value={f.email} onChange={set('email')} disabled={!canChangeRole} autoCapitalize="none" spellCheck={false} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Department"><Select value={f.department} onChange={set('department')}>
            <option value="">None</option>{[...DEPARTMENTS, 'Admin'].map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Role"><Select value={f.role} onChange={set('role')} disabled={!canChangeRole}>
            <option value="student">Student</option><option value="teacher">Teacher</option><option value="staff">Staff</option><option value="admin">Admin</option></Select></Field>
        </div>
        {isStudent ? (
          <Field label="Year and section" hint={f.department ? 'Sections recorded for this department in the student records and lab schedule.' : 'Choose a department first.'}>
            <Select value={f.course} onChange={set('course')} disabled={!f.department}>
              <option value="">Not set</option>
              {sections.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Course taught"><Input value={f.course} onChange={set('course')} /></Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone"><Input value={f.phone} onChange={set('phone')} inputMode="numeric" maxLength={11} /></Field>
          <Field label="Address"><Input value={f.address} onChange={set('address')} /></Field>
        </div>
        <div className="flex justify-end"><Button>Save changes</Button></div>
      </form>
    </Modal>
  );
}

const blank: StudentInput = { student_id: '', full_name: '', email: '', course: 'BSIT', section: '', year_level: '1st Year', phone: null, address: null, sex: null, status: 'Enrolled' };

const PAGE = 50; // students shown at a time (Show more loads the next 50)

const STATUS_STYLE: Record<StudentStatus, string> = {
  Enrolled: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Inactive: 'bg-slate-100 text-slate-700 border-slate-200',
  Dropped: 'bg-red-50 text-red-800 border-red-200',
  Graduated: 'bg-blue-50 text-blue-800 border-blue-200',
};

function Students({ q }: { q: string }) {
  const list = useLoad(() => peopleRepo.listStudents());
  const accounts = useLoad(() => peopleRepo.listProfiles('student').catch(() => [] as Profile[]));
  const [edit, setEdit] = useState<StudentInput | null>(null);
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const all = list.data ?? [];
  const rows = all.filter((s) => (!course || s.course === course) && (!year || s.year_level === year) && (!status || (s.status ?? 'Enrolled') === status)
    && match(q, s.full_name, s.email, s.student_id, s.section))
    .sort((a, b) => a.year_level.localeCompare(b.year_level) || a.student_id.localeCompare(b.student_id));
  const shown = rows.slice(0, limit);

  // Enrollment summary for the selected course (compare against the registrar's list).
  const scope = all.filter((s) => (!course || s.course === course) && (s.status ?? 'Enrolled') === 'Enrolled');
  const summary = YEAR_LEVELS.map((y) => {
    const ys = scope.filter((s) => s.year_level === y);
    return { y, male: ys.filter((s) => s.sex === 'Male').length, female: ys.filter((s) => s.sex === 'Female').length, total: ys.length };
  }).filter((r) => r.total > 0);

  async function remove(s: Student) {
    if (!(await askConfirm({ title: `Delete ${s.full_name}?`, message: 'It moves to the Archive, where an admin can restore it.', confirmLabel: 'Delete', danger: true }))) return;
    try { await peopleRepo.deleteStudent(s.id); await list.reload(); } catch (e) { setError((e as Error).message); }
  }
  async function changeStatus(s: Student, next: StudentStatus) {
    setError(null);
    try { await peopleRepo.saveStudent({ ...s, status: next }); await list.reload(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      {summary.length > 0 && (
        <Panel className="mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-muted">
                <tr>{['Enrolled' + (course ? ` ${course}` : ''), 'Male', 'Female', 'Total'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.map((r) => (
                  <tr key={r.y} className="cursor-pointer hover:bg-chalk/60" onClick={() => setYear(year === r.y ? '' : r.y)}>
                    <td className={`px-4 py-2 font-medium ${year === r.y ? 'text-accent' : ''}`}>{r.y}</td>
                    <td className="px-4 py-2">{r.male}</td><td className="px-4 py-2">{r.female}</td><td className="px-4 py-2 font-semibold">{r.total}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-4 py-2">Grand total</td>
                  <td className="px-4 py-2">{summary.reduce((n, r) => n + r.male, 0)}</td>
                  <td className="px-4 py-2">{summary.reduce((n, r) => n + r.female, 0)}</td>
                  <td className="px-4 py-2">{summary.reduce((n, r) => n + r.total, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-40"><Select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Filter by course">
          <option value="">All courses</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </Select></div>
        <div className="w-40"><Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year">
          <option value="">All years</option>{YEAR_LEVELS.map((y) => <option key={y}>{y}</option>)}
        </Select></div>
        <div className="w-40"><Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option>{STUDENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select></div>
        <span className="text-sm text-muted">{rows.length} shown</span>
        <Button className="ml-auto" onClick={() => setEdit(blank)}><Plus size={16} />Add student</Button>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <Panel>
        {rows.length === 0 ? <Empty>{list.loading ? 'Loading…' : 'No students found. Add one to get started.'}</Empty> : (<>
          {/* phones: one compact card per student */}
          <ul className="divide-y divide-line sm:hidden">
            {shown.map((s) => {
              const st = s.status ?? 'Enrolled';
              return (
                <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted">
                      <span className="font-cond font-semibold text-ink">{s.student_id}</span> · {s.course} {s.year_level.replace(' Year', ' yr')} {s.section}{s.sex ? ` · ${s.sex}` : ''}
                    </p>
                    <select value={st} onChange={(e) => changeStatus(s, e.target.value as StudentStatus)} aria-label={`Status of ${s.full_name}`}
                      className={`mt-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[st]}`}>
                      {STUDENT_STATUSES.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button>
                    <Button size="sm" variant="quiet" onClick={() => remove(s)}>Delete</Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b border-line text-left text-muted">
                <tr>{['Student ID', 'Name', 'Course', 'Year', 'Section', 'Sex', 'Status', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((s) => {
                  const st = s.status ?? 'Enrolled';
                  return (
                    <tr key={s.id}>
                      <td className="font-cond px-4 py-2.5">{s.student_id}</td>
                      <td className="px-4 py-2.5"><p className="font-medium">{s.full_name}</p><p className="text-muted">{s.email}</p></td>
                      <td className="px-4 py-2.5">{s.course}</td>
                      <td className="px-4 py-2.5">{s.year_level}</td>
                      <td className="px-4 py-2.5">{s.section}</td>
                      <td className="px-4 py-2.5">{s.sex ?? <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-2.5">
                        <select value={st} onChange={(e) => changeStatus(s, e.target.value as StudentStatus)} aria-label={`Status of ${s.full_name}`}
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[st]}`}>
                          {STUDENT_STATUSES.map((x) => <option key={x}>{x}</option>)}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button>{' '}
                        <Button size="sm" variant="quiet" onClick={() => remove(s)}>Delete</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > shown.length && (
            <button onClick={() => setLimit(limit + PAGE)} className="w-full border-t border-line py-3 text-sm font-medium text-accent hover:bg-chalk">
              Show {Math.min(PAGE, rows.length - shown.length)} more of {rows.length - shown.length}
            </button>
          )}
        </>)}
      </Panel>
      {edit && <StudentModal s={edit} onClose={() => setEdit(null)}
        onSave={async (x) => { await saveRecordKeepingLogin(x, edit, accounts.data ?? []); setEdit(null); await list.reload(); }} />}
    </>
  );
}

// Saving a record whose email changed also moves the linked login (same old email) to the new
// email, so the student keeps signing in and stays linked to the record.
async function saveRecordKeepingLogin(x: StudentInput, before: StudentInput, accounts: Profile[]) {
  const login = before.id && accounts.find((p) => p.email.toLowerCase() === before.email.toLowerCase());
  if (login && x.email.toLowerCase() !== before.email.toLowerCase()) await peopleRepo.updateAccountEmail(login.id, x.email);
  await peopleRepo.saveStudent(x);
}

function StudentModal({ s, onClose, onSave }: { s: StudentInput; onClose: () => void; onSave: (x: StudentInput) => Promise<void> }) {
  const [f, setF] = useState<StudentInput>({ ...s, status: s.status ?? 'Enrolled', sex: s.sex ?? null });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof StudentInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === 'sex' && !e.target.value ? null : e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const x = { ...f, student_id: f.student_id.trim().toUpperCase(), full_name: f.full_name.trim(), email: f.email.trim(), section: f.section.trim() };
    const errs = validateStudent(x);
    if (errs.length) return setError(errs.join(' '));
    try { await onSave(x); } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal open title={s.id ? `Edit ${s.full_name}` : 'Add student'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field label="Student ID"><Input value={f.student_id} onChange={set('student_id')} placeholder="C230505" /></Field>
          <Field label="Full name"><Input value={f.full_name} onChange={set('full_name')} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Course"><Select value={f.course} onChange={set('course')}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Year level"><Select value={f.year_level} onChange={set('year_level')}>{YEAR_LEVELS.map((y) => <option key={y}>{y}</option>)}</Select></Field>
          <Field label="Section"><Input value={f.section} onChange={set('section')} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sex"><Select value={f.sex ?? ''} onChange={set('sex')}><option value="">Not set</option>{SEXES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Status"><Select value={f.status} onChange={set('status')}>{STUDENT_STATUSES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone"><Input value={f.phone ?? ''} onChange={set('phone')} inputMode="numeric" maxLength={11} /></Field>
          <Field label="Address"><Input value={f.address ?? ''} onChange={set('address')} /></Field>
        </div>
        <div className="flex justify-end"><Button>Save student</Button></div>
      </form>
    </Modal>
  );
}
