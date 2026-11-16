import type { ReactNode } from 'react';

// Static floor-plan illustration: three labs as grids of status LEDs.
const PATTERN = 'ffiffiiffrfffifffbfffiifffffffffiff';
const COLORS: Record<string, string> = { f: '#22c55e', i: '#3b82f6', r: '#f59e0b', b: '#ef4444' };

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full md:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-rail p-10 text-white md:flex">
        <p className="font-cond text-xl font-semibold">ComLab Monitor</p>
        <div className="grid gap-8">
          {['Computer Laboratory 1', 'Computer Laboratory 2', 'Netlab'].map((name, li) => (
            <div key={name}>
              <p className="mb-2 text-sm text-slate-400">{name}</p>
              <div className="grid w-fit grid-cols-6 gap-2">
                {Array.from({ length: 30 }, (_, i) => (
                  <span key={i} className="led !h-3 !w-5 !rounded-sm"
                    style={{ color: COLORS[PATTERN[(i * (li + 2) + li * 5) % PATTERN.length]] }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="max-w-sm text-sm text-slate-400">
          See every PC in every lab, book a lab or a single seat, and keep the schedule in one place.
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
