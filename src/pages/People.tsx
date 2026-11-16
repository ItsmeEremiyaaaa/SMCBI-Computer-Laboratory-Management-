import { useState, type FormEvent } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../auth';
import { useLoad } from '../hooks/useLoad';
import { api, type StudentInput } from '../lib/api';
import { DEPARTMENTS, YEAR_LEVELS, type Profile, type Role, type Student } from '../lib/types';
import { validateStudent } from '../lib/validate';
import { Alert, Button, Empty, Field, Input, Modal, PageHeader, Panel, Select } from '../components/ui';

const TABS = [
  { id: 'teachers', label: 'Teachers' },
  { id: 'staff', label: 'Staff' },
  { id: 'students', label: 'Students' },
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
      {tab === 'students' ? <Students q={q} /> : <Accounts role={tab === 'staff' ? 'staff' : 'teacher'} q={q} />}
    </>
  );
}

const match = (q: string, ...fields: (string | null)[]) => !q || fields.some((f) => f?.toLowerCase().includes(q.toLowerCase()));

function Accounts({ role, q }: { role: Role; q: string }) {
  const { profile: me } = useAuth();
  const list = useLoad(() => api.listProfiles(role), [role]);
  const [edit, setEdit] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = (list.data ?? []).filter((p) => match(q, p.full_name, p.email, p.department))
    .sort((a, b) => Number(a.approved) - Number(b.approved) || a.full_name.localeCompare(b.full_name));

  async function patch(id: string, p: Partial<Profile>) {
    setError(null);
    try { await api.updateProfile(id, p); await list.reload(); } catch (e) { setError((e as Error).message); }
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
        {rows.length === 0 ? <Empty>{list.loading ? 'Loading…' : `No ${role === 'staff' ? 'staff' : 'teachers'} found.`}</Empty> : (
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {p.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.full_name}</p>
                  <p className="truncate text-sm text-muted">{p.email}{p.department && `, ${p.department}`}{p.course && `, ${p.course}`}</p>
                </div>
                {!p.approved && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">Waiting for approval</span>}
                <div className="flex gap-2">
                  {!p.approved && <Button size="sm" onClick={() => patch(p.id, { approved: true })}>Approve</Button>}
                  {p.approved && p.id !== me?.id &&
                    <Button size="sm" variant="quiet" onClick={() => confirm(`Remove ${p.full_name}'s access?`) && patch(p.id, { approved: false })}>Remove access</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setEdit(p)}>Edit</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {edit && <ProfileModal p={edit} canChangeRole={edit.id !== me?.id} onClose={() => setEdit(null)}
        onSave={async (x) => { await api.updateProfile(edit.id, x); setEdit(null); await list.reload(); }} />}
    </>
  );
}

function ProfileModal({ p, canChangeRole, onClose, onSave }:
  { p: Profile; canChangeRole: boolean; onClose: () => void; onSave: (x: Partial<Profile>) => Promise<void> }) {
  const [f, setF] = useState({ full_name: p.full_name, department: p.department ?? '', course: p.course ?? '', phone: p.phone ?? '', address: p.address ?? '', role: p.role });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.full_name.trim()) return setError('Full name is required.');
    if (f.phone && !/^\d{11}$/.test(f.phone)) return setError('Phone must be 11 digits, e.g. 09171234567.');
    try {
      await onSave({ full_name: f.full_name.trim(), department: f.department || null, course: f.course || null,
        phone: f.phone || null, address: f.address || null, ...(canChangeRole ? { role: f.role } : {}) });
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal open title={`Edit ${p.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Full name"><Input value={f.full_name} onChange={set('full_name')} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Department"><Select value={f.department} onChange={set('department')}>
            <option value="">None</option>{[...DEPARTMENTS, 'Admin'].map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Role"><Select value={f.role} onChange={set('role')} disabled={!canChangeRole}>
            <option value="teacher">Teacher</option><option value="staff">Staff</option><option value="admin">Admin</option></Select></Field>
        </div>
        <Field label="Course taught"><Input value={f.course} onChange={set('course')} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone"><Input value={f.phone} onChange={set('phone')} inputMode="numeric" maxLength={11} /></Field>
          <Field label="Address"><Input value={f.address} onChange={set('address')} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Save changes</Button></div>
      </form>
    </Modal>
  );
}

const blank: StudentInput = { student_id: '', full_name: '', email: '', course: 'BSIT', section: '', year_level: '1st Year', phone: null, address: null };

function Students({ q }: { q: string }) {
  const list = useLoad(() => api.listStudents());
  const [edit, setEdit] = useState<StudentInput | null>(null);
  const [course, setCourse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rows = (list.data ?? []).filter((s) => (!course || s.course === course) && match(q, s.full_name, s.email, s.student_id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  async function remove(s: Student) {
    if (!confirm(`Delete ${s.full_name}? This can't be undone.`)) return;
    try { await api.deleteStudent(s.id); await list.reload(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={course} onChange={(e) => setCourse(e.target.value)} className="w-40" aria-label="Filter by course">
          <option value="">All courses</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </Select>
        <Button className="ml-auto" onClick={() => setEdit(blank)}><Plus size={16} />Add student</Button>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <Panel>
        {rows.length === 0 ? <Empty>{list.loading ? 'Loading…' : 'No students found. Add one to get started.'}</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-line text-left text-muted">
                <tr>{['Student ID', 'Name', 'Course', 'Year', 'Section', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="font-cond px-4 py-2.5">{s.student_id}</td>
                    <td className="px-4 py-2.5"><p className="font-medium">{s.full_name}</p><p className="text-muted">{s.email}</p></td>
                    <td className="px-4 py-2.5">{s.course}</td>
                    <td className="px-4 py-2.5">{s.year_level}</td>
                    <td className="px-4 py-2.5">{s.section}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button>{' '}
                      <Button size="sm" variant="quiet" onClick={() => remove(s)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {edit && <StudentModal s={edit} onClose={() => setEdit(null)}
        onSave={async (x) => { await api.saveStudent(x); setEdit(null); await list.reload(); }} />}
    </>
  );
}

function StudentModal({ s, onClose, onSave }: { s: StudentInput; onClose: () => void; onSave: (x: StudentInput) => Promise<void> }) {
  const [f, setF] = useState(s);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof StudentInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const x = { ...f, student_id: f.student_id.trim(), full_name: f.full_name.trim(), email: f.email.trim(), section: f.section.trim() };
    const errs = validateStudent(x);
    if (errs.length) return setError(errs.join(' '));
    try { await onSave(x); } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal open title={s.id ? `Edit ${s.full_name}` : 'Add student'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field label="Student ID"><Input value={f.student_id} onChange={set('student_id')} placeholder="2025-0001" /></Field>
          <Field label="Full name"><Input value={f.full_name} onChange={set('full_name')} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Course"><Select value={f.course} onChange={set('course')}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Year level"><Select value={f.year_level} onChange={set('year_level')}>{YEAR_LEVELS.map((y) => <option key={y}>{y}</option>)}</Select></Field>
          <Field label="Section"><Input value={f.section} onChange={set('section')} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone"><Input value={f.phone ?? ''} onChange={set('phone')} inputMode="numeric" maxLength={11} /></Field>
          <Field label="Address"><Input value={f.address ?? ''} onChange={set('address')} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Save student</Button></div>
      </form>
    </Modal>
  );
}
