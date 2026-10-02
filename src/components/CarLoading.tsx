// The page loading screen: a light-blue sedan with turning wheels over a moving road, or for home
// policies a light-blue house with smoke rising from the chimney.
import { useSyncExternalStore } from 'react';
import { carLoaderStore } from '@/services/carLoader';
import { visualPrefsStore } from '@/services/visualPrefs';

function Wheel({ cx }: { cx: number }) {
  return <g className="car-wheel" style={{ transformOrigin: `${cx}px 80px` }}>
    <circle cx={cx} cy={80} r={13} fill="#2b2f33" />
    <circle cx={cx} cy={80} r={6.5} fill="#fff" />
    <path d={`M${cx - 6.5} 80h13M${cx} 73.5v13`} stroke="#2b2f33" strokeWidth={1.6} />
  </g>;
}

export function CarIllustration() {
  return <svg viewBox="0 0 200 104" className="h-auto w-[200px]" aria-hidden>
    <g className="car-body">
      <path d="M14 62c0-6 3-9 8-10l22-4 22-22c3-3 6-4 10-4h62c4 0 7 2 9 5l14 21 16 4c5 1 8 5 8 10v12c0 3-2 5-5 5H19c-3 0-5-2-5-5z" fill="#8fd6f2" stroke="#2b2f33" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M56 46l15-15c2-2 4-3 7-3h17v18z" fill="#fff" stroke="#2b2f33" strokeWidth={2} strokeLinejoin="round" />
      <path d="M101 28h30c2 0 4 1 5 3l10 15h-45z" fill="#fff" stroke="#2b2f33" strokeWidth={2} strokeLinejoin="round" />
      <path d="M98 30v43M60 56h12M108 56h12" stroke="#2b2f33" strokeWidth={2} strokeLinecap="round" />
      <path d="M170 56h12c2 0 4 2 4 4v3h-12z" fill="#fff" stroke="#2b2f33" strokeWidth={1.8} strokeLinejoin="round" />
      <rect x={14} y={56} width={6} height={9} rx={1.5} fill="#fff" stroke="#2b2f33" strokeWidth={1.6} />
      <path d="M176 70h12" stroke="#2b2f33" strokeWidth={2} strokeLinecap="round" />
    </g>
    <Wheel cx={44} />
    <Wheel cx={152} />
    <path d="M10 95h180" stroke="#cfd8de" strokeWidth={2} strokeLinecap="round" className="car-road" strokeDasharray="14 10" />
  </svg>;
}

export function HomeIllustration() {
  return <svg viewBox="0 0 200 124" className="h-auto w-[200px]" aria-hidden>
    {/* Smoke puffs drifting up from the chimney. */}
    {[0, 1, 2].map((index) => <circle key={index} cx={135} cy={18} r={4.5 + index * 1.5} fill="#dbe4ea" className="house-smoke" style={{ animationDelay: `${index * 0.55}s` }} />)}
    <g>
      {/* Chimney (behind the roof), walls, then the roof over them. */}
      <rect x={128} y={26} width={15} height={30} fill="#8fd6f2" stroke="#2b2f33" strokeWidth={2.4} strokeLinejoin="round" />
      <rect x={125} y={22} width={21} height={7} rx={1.5} fill="#fff" stroke="#2b2f33" strokeWidth={2} />
      <rect x={42} y={60} width={116} height={44} fill="#8fd6f2" stroke="#2b2f33" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M26 64L100 16l74 48z" fill="#5fb7de" stroke="#2b2f33" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M44 56h112" stroke="#2b2f33" strokeWidth={1.6} strokeLinecap="round" opacity={0.35} />
      <circle cx={100} cy={44} r={7} fill="#fff" stroke="#2b2f33" strokeWidth={2} />
      <path d="M100 37v14M93 44h14" stroke="#2b2f33" strokeWidth={1.4} />
      <rect x={88} y={74} width={24} height={30} rx={2} fill="#fff" stroke="#2b2f33" strokeWidth={2.2} />
      <circle cx={106} cy={90} r={1.9} fill="#2b2f33" />
      <g className="house-window">
        <rect x={54} y={72} width={22} height={19} rx={1.5} fill="#fff" stroke="#2b2f33" strokeWidth={2.2} />
        <path d="M65 72v19M54 81.5h22" stroke="#2b2f33" strokeWidth={1.6} />
        <rect x={124} y={72} width={22} height={19} rx={1.5} fill="#fff" stroke="#2b2f33" strokeWidth={2.2} />
        <path d="M135 72v19M124 81.5h22" stroke="#2b2f33" strokeWidth={1.6} />
      </g>
      <path d="M84 104h32" stroke="#2b2f33" strokeWidth={2.4} strokeLinecap="round" />
    </g>
    <path d="M10 106h180" stroke="#cfd8de" strokeWidth={2} strokeLinecap="round" strokeDasharray="14 10" />
  </svg>;
}

export function CarLoading() {
  const icon = useSyncExternalStore(carLoaderStore.subscribe, carLoaderStore.get);
  const { reduceMotion } = useSyncExternalStore(visualPrefsStore.subscribe, visualPrefsStore.get);
  if (!icon) return null;
  return <div role="status" aria-live="polite" aria-busy="true" aria-label={icon === 'home' ? 'Loading home policy' : 'Loading'} className={`fixed inset-0 z-[210] flex flex-col items-center justify-center bg-white print:hidden ${reduceMotion ? 'reduce-motion' : ''}`}>
    {icon === 'home' ? <HomeIllustration /> : <CarIllustration />}
    <p className="mt-[70px] text-[19px] font-medium tracking-[-.1px] text-[#0b74b8]">Loading...this should only take a moment.</p>
  </div>;
}
