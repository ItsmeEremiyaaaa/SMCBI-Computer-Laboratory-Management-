import { useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { reportsRepo } from '../data/repository';
import { PROBLEMS } from '../../../shared/data/types';
import { Alert, Button, Field, Modal, Textarea } from '../../../shared/ui/ui';

// "Report a problem" for students and teachers. It only notifies staff; it never marks the PC broken itself.
export default function ReportProblem({ pcId, pcLabel, onDone }: { pcId: string; pcLabel: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => { setOpen(false); setProblem(''); setNote(''); setError(null); };
  async function send() {
    if (!problem) return setError('Choose what is wrong.');
    if (problem === 'Other' && !note.trim()) return setError('Tell staff what is wrong in the note.');
    setBusy(true); setError(null);
    try { await reportsRepo.reportProblem(pcId, problem, note); setSent(true); close(); onDone?.(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (sent) {
    return <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><CheckCircle2 size={16} />Thanks — staff were told about {pcLabel}.</p>;
  }
  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)} className="w-full text-amber-800">
        <TriangleAlert size={16} />Report a problem
      </Button>
      <Modal open={open} title={`Report a problem with ${pcLabel}`} onClose={close}>
        <div className="grid gap-4">
          {error && <Alert>{error}</Alert>}
          <div>
            <p className="mb-2 text-sm font-medium">What's wrong?</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Problem">
              {PROBLEMS.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={problem === p} onClick={() => setProblem(p)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${problem === p ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-chalk'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Field label={problem === 'Other' ? 'What happened?' : 'Note (optional)'}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200} placeholder="e.g. Screen stays black after turning on" />
          </Field>
          <p className="text-xs text-muted">Staff check reports and mark the PC broken if needed. You can only have one open report per PC.</p>
          <div className="flex justify-end">
            <Button type="button" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send report'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
