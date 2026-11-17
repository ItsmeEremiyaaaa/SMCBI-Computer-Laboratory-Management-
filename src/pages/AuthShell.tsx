import type { ReactNode } from 'react';
import { Crest } from '../components/ui';

// Static floor-plan illustration: three labs as grids of status LEDs.
const PATTERN = 'ffiffiiffrfffifffbfffiifffffffffiff';
const COLORS: Record<string, string> = { f: '#22c55e', i: '#3b82f6', r: '#f59e0b', b: '#ef4444' };

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full md:grid-cols-[1.1fr_1fr]">
      <div className="navy-weave relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex">
        <div className="absolute inset-y-0 right-0 w-1 bg-gold" aria-hidden />
        <div className="flex items-center gap-4">
          <Crest size={56} />
          <div>
            <p className="font-serif text-2xl font-semibold">ComLab Monitor</p>
            <p className="text-sm text-gold">St. Mary’s College of Bansalan, Inc.</p>
            <p className="text-xs text-slate-400">College of Information Technology</p>
          </div>
        </div>
        <div className="grid gap-7">
          {['Computer Laboratory 1', 'Computer Laboratory 2', 'Netlab'].map((name, li) => (
            <div key={name}>
              <p className="mb-2 text-sm text-slate-300">{name}</p>
              <div className="grid w-fit grid-cols-6 gap-2">
                {Array.from({ length: 30 }, (_, i) => (
                  <span key={i} className="led !h-3 !w-5 !rounded-sm"
                    style={{ color: COLORS[PATTERN[(i * (li + 2) + li * 5) % PATTERN.length]] }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="max-w-sm border-l-2 border-gold pl-3 text-sm text-slate-300">
          See every PC in every lab, book a lab or a single seat, and keep the class schedule in one place.
        </p>
      </div>
      <div className="flex items-center justify-center bg-panel p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <Crest size={44} />
            <div>
              <p className="font-serif text-xl font-semibold text-rail">ComLab Monitor</p>
              <p className="text-xs text-muted">St. Mary’s College of Bansalan, Inc.</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
