import type { ReactNode } from 'react';
import { Crest } from '../../../shared/ui/ui';

// Deterministic "random" stars so the sky doesn't jump between renders.
const STARS = Array.from({ length: 60 }, (_, i) => ({
  x: (i * 37.7) % 100, y: (i * 61.3) % 100, r: i % 7 === 0 ? 2 : 1, d: (i % 5) * 0.7,
}));

function Sky() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {STARS.map((s, i) => (
        <span key={i} className="absolute rounded-full bg-white auth-twinkle"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2, animationDelay: `${s.d}s`, opacity: 0.35 + (i % 3) * 0.2 }} />
      ))}
      {/* distant hills and pine trees along the bottom */}
      <svg className="absolute inset-x-0 bottom-0 h-40 w-full" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path d="M0 110 C 200 60 380 130 600 90 S 1000 40 1200 95 S 1400 120 1440 100 V160 H0Z" fill="#26307a" opacity=".7" />
        <path d="M0 135 C 260 100 520 150 760 120 S 1180 95 1440 130 V160 H0Z" fill="#1c2466" />
        {[60, 120, 1290, 1350, 1395].map((x, i) => (
          <path key={x} d={`M${x} ${150 - (i % 2) * 18} l18 -${46 + (i % 3) * 10} l18 ${46 + (i % 3) * 10}z`} fill="#161d57" />
        ))}
      </svg>
    </div>
  );
}

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_top,#3b47b8,#1a2366_60%,#121a52)] px-4 py-8 sm:py-12">
      <Sky />

      {/* One card: wide with a scene on the left (desktop), portrait with playful corner shapes (phone). */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-[0_40px_80px_-20px_rgb(8_12_50/.6)] lg:grid lg:max-w-5xl lg:grid-cols-[1.35fr_1fr]">
        {/* desktop: flowing waves behind the scene */}
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden>
          <path d="M0 0 H780 C 660 80 440 70 300 150 C 190 215 80 205 0 250Z" fill="#e8ecfb" />
          <path d="M0 0 H640 C 540 70 360 55 240 120 C 150 170 70 168 0 200Z" fill="#3b47b8" />
          <path d="M1000 600 H560 C 640 560 720 590 800 520 C 880 450 930 470 1000 430Z" fill="#e8ecfb" />
          <path d="M1000 600 H720 C 780 575 840 585 890 540 C 935 500 965 505 1000 490Z" fill="#3b47b8" opacity=".9" />
        </svg>
        {/* phone: wave, sun and dots across the top, a soft circle bottom-right */}
        <svg className="pointer-events-none absolute inset-x-0 top-0 h-32 w-full lg:hidden" viewBox="0 0 360 130" preserveAspectRatio="none" aria-hidden>
          <path d="M0 0 H360 V40 C 300 85 230 30 160 70 C 100 104 50 80 0 100Z" fill="#3b47b8" />
          <circle cx="300" cy="28" r="34" fill="#f59e0b" opacity=".9" />
        </svg>
        <div className="absolute left-6 top-6 lg:hidden"><Crest size={40} /></div>
        <svg className="pointer-events-none absolute -bottom-12 -right-12 h-28 w-28 lg:hidden" viewBox="0 0 100 100" aria-hidden>
          <circle cx="60" cy="60" r="40" fill="#e8ecfb" />
          <circle cx="38" cy="70" r="10" fill="#fda4af" />
          <circle cx="78" cy="34" r="6" fill="#f59e0b" />
        </svg>

        <section className="relative hidden min-h-[600px] flex-col p-10 lg:flex">
          <div className="flex items-center gap-3">
            <Crest size={46} />
            <div className="leading-tight text-white">
              <p className="text-lg font-bold tracking-tight">ComLab Monitor</p>
              <p className="text-xs text-blue-100">St. Mary’s College of Bansalan</p>
            </div>
          </div>
          <div className="mt-auto pb-10">
            <h2 className="text-5xl leading-tight text-[#1e2a6e]">
              Every lab, <b className="font-extrabold">every PC</b>
              <span className="block text-4xl font-light">in one place.</span>
            </h2>
            <p className="mt-3 max-w-sm text-slate-500">Check free seats, book a NetLab PC, and check in by scanning your PC’s QR code.</p>
          </div>
        </section>

        <section className="relative px-7 pb-10 pt-32 lg:flex lg:items-center lg:justify-center lg:p-10 lg:pl-4">
          <div className="w-full lg:max-w-xs">{children}</div>
        </section>
      </div>

      <p className="relative mt-6 text-center text-xs text-blue-200/80">St. Mary’s College of Bansalan, Inc. · College of Information Technology</p>
    </div>
  );
}
