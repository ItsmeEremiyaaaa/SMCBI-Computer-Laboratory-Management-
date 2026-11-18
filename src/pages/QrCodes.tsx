import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import { Button, PageHeader } from '../components/ui';

const LAB_NAME: Record<string, string> = { lab1: 'Computer Laboratory 1', lab2: 'Computer Laboratory 2', netlab: 'Networking Laboratory' };

// Printable QR stickers, one per PC. Scanning one opens /checkin/<pc id> on the student's phone.
export default function QrCodes() {
  const { labId = 'lab1' } = useParams();
  const labs = useLoad(() => api.listLabs());
  const pcs = useLoad(() => api.listPcs(labId), [labId]);
  const [svgs, setSvgs] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    Promise.all((pcs.data ?? []).map(async (pc) =>
      [pc.id, await QRCode.toString(`${location.origin}/checkin/${pc.id}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })] as const))
      .then((rows) => alive && setSvgs(Object.fromEntries(rows)));
    return () => { alive = false; };
  }, [pcs.data]);

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="PC QR codes" sub="Print and stick one on each PC. Students scan it to check in to that seat."
          actions={<Button onClick={() => print()}><Printer size={16} />Print</Button>} />
        <nav className="mb-4 flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1" aria-label="Lab">
          {labs.data?.map((l) => (
            <NavLink key={l.id} to={`/qr/${l.id}`}
              className={({ isActive }) => `rounded-md px-3 py-1.5 text-sm font-medium ${isActive || (l.id === labId) ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
              {LAB_NAME[l.id] ?? l.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
        {(pcs.data ?? []).map((pc) => (
          <figure key={pc.id} className="break-inside-avoid rounded-xl border border-line bg-white p-3 text-center print:rounded-none">
            {/* SVG made locally by the qrcode library from our own URL, not user input */}
            <div className="mx-auto aspect-square w-full max-w-40" dangerouslySetInnerHTML={{ __html: svgs[pc.id] ?? '' }} />
            <figcaption className="mt-1">
              <p className="font-cond text-xl font-bold leading-tight">{pc.label}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{LAB_NAME[pc.lab_id] ?? pc.lab_id} · scan to check in</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
