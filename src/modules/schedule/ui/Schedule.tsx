import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarClock, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { useLoad } from '../../../shared/hooks/useLoad';
import { bookingsRepo } from '../../bookings/data/repository';
import { labsRepo } from '../../labs/data/repository';
import { scheduleRepo } from '../data/repository';
import { isoWeekday, LAB_CLOSE, LAB_OPEN, manilaNow } from '../../../shared/time';
import { classesOn, termOf } from '../logic/rules';
import type { ClassSchedule, Lab, ScheduleInput } from '../../../shared/data/types';
import { validateSchedule } from '../logic/rules';
import { COLUMNS, rowsToSchedules, schedulesToRows, type Cell } from '../logic/excel';
import { Alert, Button, Empty, Field, fmtDate, fmtTime, Input, Modal, PageHeader, Panel, Select, askConfirm, toast } from '../../../shared/ui/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const labDisplayName = (lab?: Lab) => {
  if (!lab) return '';
  if (lab.id === 'lab1' || lab.name.includes('1')) return 'Computer Laboratory 1';
  if (lab.id === 'lab2' || lab.name.includes('2')) return 'Computer Laboratory 2';
  if (lab.id === 'netlab' || lab.name.toLowerCase().includes('netlab') || lab.name.toLowerCase().includes('networking')) return 'Networking Laboratory';
  return lab.name;
};

export default function Schedule() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const labs = useLoad(() => labsRepo.listLabs());
  const list = useLoad(() => scheduleRepo.listSchedules());
  const [edit, setEdit] = useState<ScheduleInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => bookingsRepo.subscribeReservations(list.reload), [list.reload]);

  const today = manilaNow();
  const todayDow = isoWeekday(today.date);
  // semester filter: the terms that have classes, newest first; starts on the current term
  const all = list.data ?? [];
  const terms = [...new Map(all.map((r) => { const t = termOf(r.starts_on); return [t.key, t] as const; })).values()]
    .sort((a, b) => b.key.localeCompare(a.key));
  const [term, setTerm] = useState('');
  const current = termOf(today.date).key;
  const shown = term || (terms.some((t) => t.key === current) ? current : terms[0]?.key ?? '');
  const termLabel = terms.find((t) => t.key === shown)?.label ?? termOf(today.date).label;
  const rows = shown === 'all' ? all : all.filter((r) => termOf(r.starts_on).key === shown);
  const days = DAYS.map((name, i) => ({ name, dow: i + 1 })).filter((d) => d.dow <= 5 || rows.some((r) => r.day_of_week === d.dow));
  const first = rows.reduce((a, r) => (r.starts_on < a ? r.starts_on : a), rows[0]?.starts_on ?? '');
  const last = rows.reduce((a, r) => (r.ends_on > a ? r.ends_on : a), rows[0]?.ends_on ?? '');
  // happening right now (one-day changes apply: a cancelled class isn't 'now', a moved one is at its new time)
  const nowMeetings = classesOn(today.date, all);
  const live = (r: ClassSchedule) => nowMeetings.some((m) => m.schedule_id === r.id && m.start_time <= today.time && today.time < m.end_time);

  async function remove(r: ClassSchedule) {
    if (!(await askConfirm({ title: `Remove ${r.section} ${r.subject}?`, message: `The ${DAYS[r.day_of_week - 1]} class. It moves to the Archive, where an admin can restore it.`, confirmLabel: 'Remove', danger: true }))) return;
    try { await scheduleRepo.deleteSchedule(r.id); await list.reload(); } catch (e) { setError((e as Error).message); }
  }

  // ---- Excel export / import (exceljs only loads when one of these is used) ----
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ name: string; ok: ScheduleInput[]; problems: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  async function exportExcel() {
    try {
      const { Workbook } = await import('exceljs');
      const wb = new Workbook();
      const ws = wb.addWorksheet('Class schedule');
      ws.addRow([...COLUMNS]).font = { bold: true };
      schedulesToRows(rows, labs.data ?? []).forEach((r) => ws.addRow(r));
      ws.columns.forEach((c, i) => { c.width = [24, 12, 30, 30, 12, 9, 9, 13, 13][i]; });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      const blob = new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ComLab class schedule - ${shown === 'all' ? 'all terms' : termLabel}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setError(`Couldn't create the Excel file: ${(e as Error).message}`); }
  }

  async function readExcel(file: File) {
    if (!/\.xlsx$/i.test(file.name)) { setError('Choose an Excel file (.xlsx).'); return; }
    try {
      const { Workbook } = await import('exceljs');
      const wb = new Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) { setError('That Excel file has no sheets.'); return; }
      // plain values: formulas → result, rich text / links → their text
      const plain = (v: unknown): Cell => {
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
          if ('result' in o) return plain(o.result);
          if (o.richText) return o.richText.map((t) => t.text).join('');
          if (typeof o.text === 'string') return o.text;
          return '';
        }
        return v as Cell;
      };
      const sheet: Cell[][] = [];
      ws.eachRow({ includeEmpty: true }, (row) => { sheet.push((row.values as unknown[]).slice(1).map(plain)); });
      setPreview({ name: file.name, ...rowsToSchedules(sheet, labs.data ?? [], all) });
    } catch { setError("Couldn't read that file. Save it as an Excel workbook (.xlsx) and try again."); }
  }

  async function importClasses() {
    if (!preview) return;
    setImporting(true); setError(null);
    const failed: string[] = [];
    for (const c of preview.ok) {
      try { await scheduleRepo.saveSchedule(c); } catch (e) { failed.push(`${c.section} ${c.subject}: ${(e as Error).message}`); }
    }
    setImporting(false);
    await list.reload();
    if (preview.ok[0]) setTerm(termOf(preview.ok[0].starts_on).key);
    setPreview(null);
    if (failed.length) setError(`${failed.length} class(es) were not added: ${failed.join(' · ')}`);
    const added = preview.ok.length - failed.length;
    if (added) toast(`${added} class${added === 1 ? '' : 'es'} added`, preview.ok[0] ? termOf(preview.ok[0].starts_on).label : undefined);
  }

  const blank = (): ScheduleInput => ({
    lab_id: labs.data?.[0]?.id ?? '', section: '', subject: '', instructor: '', day_of_week: 1,
    start_time: '09:00', end_time: '12:00', starts_on: first || today.date, ends_on: last || today.date,
  });

  return (
    <>
      <PageHeader title="Class schedule"
        sub={<>Regular weekly lab classes{shown === 'all' ? ', all terms' : <> for the {termLabel}</>}{first && <> ({fmtDate(first)} to {fmtDate(last)})</>}.
          Labs show as In use during these hours and can’t be booked over them.</>}
        actions={isAdmin && labs.data && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={exportExcel} disabled={!rows.length} title="Download this term as an Excel file"><Download size={16} />Export Excel</Button>
            <Button variant="ghost" onClick={() => fileInput.current?.click()} title="Add classes from an Excel file"><Upload size={16} />Import Excel</Button>
            <input ref={fileInput} type="file" hidden accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readExcel(f); }} />
            <Button onClick={() => setEdit(blank())}><Plus size={16} />Add class</Button>
          </div>
        )} />

      {preview && (
        <Modal open wide title={`Import from ${preview.name}`} onClose={() => setPreview(null)}>
          <div className="grid gap-4">
            <p className="text-sm">
              <b className="text-emerald-700">{preview.ok.length} class{preview.ok.length === 1 ? '' : 'es'} ready to add</b>
              {preview.problems.length > 0 && <> · <b className="text-red-700">{preview.problems.length} row{preview.problems.length === 1 ? '' : 's'} skipped</b></>}
              {preview.ok[0] && <span className="text-muted"> · {termOf(preview.ok[0].starts_on).label}</span>}
            </p>
            {preview.problems.length > 0 && (
              <ul className="max-h-40 overflow-y-auto rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {preview.problems.map((x) => <li key={x}>{x}</li>)}
              </ul>
            )}
            {preview.ok.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-md border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-chalk"><tr>{COLUMNS.map((c) => <th key={c} className="px-2 py-1.5 font-semibold">{c}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {schedulesToRows(preview.ok.map((c, i) => ({ ...c, id: String(i) })), labs.data ?? []).map((r, i) => (
                      <tr key={i}>{r.map((v, j) => <td key={j} className="whitespace-nowrap px-2 py-1">{v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button disabled={!preview.ok.length || importing} onClick={importClasses}>
                {importing ? 'Adding…' : `Add ${preview.ok.length} class${preview.ok.length === 1 ? '' : 'es'}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {(error || list.error) && <div className="mb-4"><Alert>{error || list.error}</Alert></div>}

      {terms.length > 0 && (
        <nav className="mb-4 flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1" aria-label="Semester">
          {[...terms, ...(terms.length > 1 ? [{ key: 'all', label: 'All terms' }] : [])].map((t) => (
            <button key={t.key} type="button" onClick={() => setTerm(t.key)} aria-pressed={shown === t.key}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${shown === t.key ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
              {t.label}{t.key === current && <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${shown === t.key ? 'bg-white/25' : 'bg-chalk'}`}>now</span>}
            </button>
          ))}
        </nav>
      )}

      {rows.length === 0 ? <Panel><Empty>{list.loading ? 'Loading…' : 'No classes yet.'}</Empty></Panel> : (
        <div className="grid gap-4">
          {days.map((d) => {
            const dayRows = rows.filter((r) => r.day_of_week === d.dow);
            return (
              <Panel key={d.dow} title={d.name} icon={CalendarClock}
                actions={d.dow === todayDow && <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-accent">Today</span>}>
                <div className="grid gap-px overflow-hidden rounded-b-lg bg-line md:grid-cols-3">
                  {labs.data?.map((l) => {
                    const cell = dayRows.filter((r) => r.lab_id === l.id).sort((a, b) => a.start_time.localeCompare(b.start_time));
                    return (
                      <div key={l.id} className="bg-panel p-3">
                        <p className="mb-2 text-xs font-bold tracking-wide text-ink">{labDisplayName(l)}</p>
                        {cell.length === 0 ? <p className="py-2 text-sm text-muted/70">No classes, open for booking</p> : (
                          <ul className="grid gap-2">
                            {cell.map((r) => (
                              <li key={r.id} className={`group relative rounded-md border-l-4 px-3 py-2 text-sm ${live(r) ? 'border-blue-600 bg-blue-50/90' : 'border-accent bg-accent-soft/60'}`}>
                                <p className="font-cond font-semibold text-rail">
                                  {fmtTime(r.start_time)} to {fmtTime(r.end_time)}
                                  {live(r) && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">● In session (In use)</span>}
                                </p>
                                <p className="font-medium">{r.section}</p>
                                <p className="text-muted">{r.subject}</p>
                                {r.instructor && <p className="text-xs text-muted">{r.instructor}</p>}
                                {isAdmin && (
                                  <div className="absolute right-1.5 top-1.5 flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                    <button onClick={() => setEdit(r)} aria-label={`Edit ${r.section} ${r.subject}`} className="rounded p-1 text-muted hover:bg-white hover:text-ink"><Pencil size={14} /></button>
                                    <button onClick={() => remove(r)} aria-label={`Remove ${r.section} ${r.subject}`} className="rounded p-1 text-muted hover:bg-white hover:text-broken"><Trash2 size={14} /></button>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {edit && labs.data && <ScheduleModal s={edit} labs={labs.data} onClose={() => setEdit(null)}
        onSave={async (x) => { await scheduleRepo.saveSchedule(x); setEdit(null); await list.reload(); }} />}
    </>
  );
}

function ScheduleModal({ s, labs, onClose, onSave }:
  { s: ScheduleInput; labs: Lab[]; onClose: () => void; onSave: (x: ScheduleInput) => Promise<void> }) {
  const [f, setF] = useState(s);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ScheduleInput) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: k === 'day_of_week' ? Number(e.target.value) : e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const x = { ...f, section: f.section.trim(), subject: f.subject.trim(), instructor: f.instructor.trim() };
    const errs = validateSchedule(x);
    if (errs.length) return setError(errs.join(' '));
    try { await onSave(x); } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal open title={s.id ? 'Edit class' : 'Add class'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Section"><Input value={f.section} onChange={set('section')} placeholder="BSIT 1A" /></Field>
          <Field label="Lab"><Select value={f.lab_id} onChange={set('lab_id')}>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        </div>
        <Field label="Subject"><Input value={f.subject} onChange={set('subject')} placeholder="IT121 Computer Programming 2" /></Field>
        <Field label="Instructor"><Input value={f.instructor} onChange={set('instructor')} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Day"><Select value={f.day_of_week} onChange={set('day_of_week')}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</Select></Field>
          <Field label="Start time"><Input type="time" min={LAB_OPEN} max={LAB_CLOSE} value={f.start_time} onChange={set('start_time')} /></Field>
          <Field label="End time"><Input type="time" min={LAB_OPEN} max={LAB_CLOSE} value={f.end_time} onChange={set('end_time')} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First day"><Input type="date" value={f.starts_on} onChange={set('starts_on')} /></Field>
          <Field label="Last day"><Input type="date" value={f.ends_on} onChange={set('ends_on')} /></Field>
        </div>
        <div className="flex justify-end"><Button>Save class</Button></div>
      </form>
    </Modal>
  );
}
