// Session timeout warning, signed-out screen and the transaction "Processing..." overlay.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Loader2, LockKeyhole } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { IDLE_WARNING_MS, WARNING_COUNTDOWN_S, sessionStore, signIn, signOut } from '@/services/session';
import { processingStore } from '@/services/processing';

function ProcessingOverlay() {
  const label = useSyncExternalStore(processingStore.subscribe, processingStore.get);
  if (!label) return null;
  return <div role="alert" aria-busy="true" className="fixed inset-0 z-[200] flex items-center justify-center bg-[#003865]/35 print:hidden">
    <div className="flex items-center gap-3 rounded-[4px] bg-white px-[26px] py-[18px] text-[15px] font-medium text-[#1b2a36] shadow-2xl"><Loader2 size={24} className="animate-spin text-[#0073cf]" />{label}</div>
  </div>;
}

function SignedOut({ reason }: { reason: string }) {
  const { state } = useQuote();
  return <div className="flex min-h-screen flex-col bg-[#f1f6f9]">
    <header className="flex h-[60px] items-center bg-[#003865] px-[24px] text-[19px] font-light tracking-[-.4px] text-white">LAVA<b className="font-bold">TRAINING</b></header>
    <main className="mx-auto mt-[80px] w-[440px] rounded-[3px] border border-[#cfdbe3] bg-white p-[28px] text-[#1b2a36] shadow-sm">
      <LockKeyhole size={34} strokeWidth={1.4} className="text-[#003865]" />
      <h1 className="mt-3 font-slab text-[22px] font-bold">{reason === 'timeout' ? 'Your session timed out' : 'You have signed out'}</h1>
      <p className="mt-2 text-[14px] leading-[20px] text-[#3d4b55]">{reason === 'timeout' ? 'For your security you were signed out after 15 minutes of inactivity. Unsaved changes on the page you were on may have been lost.' : 'Thank you for using LAVA Training. Close your browser if you are on a shared computer.'}</p>
      <div className="mt-5 rounded-[3px] border border-[#cfdbe3] bg-[#f6f9fb] px-3 py-2 text-[13px]">User: <b>{state.agent.name}</b> · {state.agent.agencyName} ({state.agent.agencyCode})</div>
      <button type="button" autoFocus onClick={signIn} className="mt-5 h-[42px] w-full rounded-[3px] bg-[#0073cf] text-[14px] font-bold uppercase text-white hover:bg-[#003865]">Sign In</button>
    </main>
  </div>;
}

function TimeoutWarning({ onStay }: { onStay: () => void }) {
  const [left, setLeft] = useState(WARNING_COUNTDOWN_S);
  useEffect(() => {
    const timer = window.setInterval(() => setLeft((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (left <= 0) signOut('timeout'); }, [left]);
  const minutes = Math.floor(Math.max(0, left) / 60);
  const seconds = String(Math.max(0, left) % 60).padStart(2, '0');
  return <div role="alertdialog" aria-modal aria-label="Session timeout warning" className="fixed inset-0 z-[190] flex items-start justify-center bg-[#1b2a36]/55 pt-[140px]">
    <div className="w-[440px] rounded-[3px] bg-white p-[24px] text-[#1b2a36] shadow-2xl">
      <h2 className="font-slab text-[19px] font-bold">Your session is about to expire</h2>
      <p className="mt-2 text-[14px]">You will be signed out in <b className="tabular-nums">{minutes}:{seconds}</b> because of inactivity.</p>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => signOut('manual')} className="h-[38px] rounded-[3px] border-2 border-[#0073cf] px-[14px] text-[13px] font-bold uppercase text-[#003865]">Sign Out</button><button type="button" autoFocus onClick={onStay} className="h-[38px] rounded-[3px] bg-[#0073cf] px-[14px] text-[13px] font-bold uppercase text-white hover:bg-[#003865]">Stay Signed In</button></div>
    </div>
  </div>;
}

export function SessionGuard({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
  const [warning, setWarning] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (session.signedOut) return;
    const reset = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setWarning(true), IDLE_WARNING_MS);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    reset();
    return () => { window.clearTimeout(timer.current); events.forEach((name) => window.removeEventListener(name, reset)); };
  }, [session.signedOut]);
  if (session.signedOut) return <SignedOut reason={session.reason} />;
  return <>{children}{warning && <TimeoutWarning onStay={() => setWarning(false)} />}<ProcessingOverlay /></>;
}
