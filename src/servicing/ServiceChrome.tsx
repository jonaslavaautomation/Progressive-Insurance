// Shared chrome for Manage Policies screens: header, training clock and the fixed action bar.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarClock, Clock3, Trash2 } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { Logo, PageLinks } from '@/components/wizard/WizardLayout';

const focusable = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';
export const outlineButton = `flex h-[40px] items-center gap-[8px] rounded-[3px] border-2 border-[#0073cf] bg-white px-[16px] text-[12.5px] font-bold uppercase text-[#003865] hover:bg-[#e8f4fa] disabled:cursor-not-allowed disabled:opacity-50 ${focusable}`;
export const solidButton = `flex h-[40px] items-center gap-[8px] rounded-[3px] border-2 border-[#0073cf] bg-[#0073cf] px-[16px] text-[12.5px] font-bold uppercase text-white hover:border-[#003865] hover:bg-[#003865] disabled:cursor-not-allowed disabled:opacity-50 ${focusable}`;
export const dangerButton = `flex h-[40px] items-center gap-[8px] rounded-[3px] border-2 border-[#c8102e] bg-white px-[16px] text-[12.5px] font-bold uppercase text-[#c8102e] hover:bg-[#fdf0f1] disabled:cursor-not-allowed disabled:opacity-50 ${focusable}`;

function HeaderItem({ label, value }: { label: string; value: string }) {
  return <div className="mr-[30px] min-w-0"><div className="text-[11px] font-bold uppercase leading-[14px] tracking-[.2px]">{label}</div><div className="mt-[3px] min-h-[20px] truncate font-slab text-[15px] leading-[20px]">{value}</div></div>;
}

export function ServiceHeader({ customer }: { customer?: { name: string; phone: string; email: string } }) {
  const { state, showDashboard, openPolicies } = useQuote();
  return <header className="flex h-[60px] shrink-0 items-center bg-[#003865] pl-[24px] pr-[26px] text-white print:hidden">
    <button type="button" onClick={showDashboard} title="Return to dashboard" className={`w-[195px] shrink-0 text-left ${focusable}`}><Logo /></button>
    {customer ? <><HeaderItem label="Customer" value={customer.name} /><HeaderItem label="Phone" value={customer.phone} /><HeaderItem label="Email" value={customer.email} /></> : <HeaderItem label="Manage Policies" value="Policy Search" />}
    <div className="ml-auto flex shrink-0 items-center gap-[26px] text-[13px]">
      <span className="font-medium">Hello, {state.agent.name}</span>
      <button type="button" onClick={() => openPolicies(state.ui.policyQuery)} className={`font-bold underline underline-offset-2 ${focusable}`}>POLICY SEARCH</button>
      <button type="button" onClick={showDashboard} className={`font-bold underline underline-offset-2 ${focusable}`}>DASHBOARD</button>
    </div>
  </header>;
}

/** Trainer control that moves "today" forward so billing, cancellation and renewal events happen. */
export function TrainingClock() {
  const { state, advanceClock, clearPolicies } = useQuote();
  const [notice, setNotice] = useState('');
  const events = state.policies.reduce((sum, policy) => sum + policy.history.length, 0);
  const before = useRef<number | null>(null);
  useEffect(() => {
    if (before.current === null) return;
    const added = events - before.current;
    before.current = null;
    setNotice(added > 0 ? `${added} policy event${added > 1 ? 's' : ''} processed. Check the policy History and Documents tabs.` : 'No policy events on those days.');
    const timer = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [events, state.simDate]);
  const advance = (days: number) => { before.current = events; advanceClock(days); };
  const chip = `h-[30px] rounded-[3px] border border-[#0073cf] bg-white px-[10px] text-[12px] font-bold text-[#003865] hover:bg-[#e8f4fa] ${focusable}`;
  return <div className="mb-[20px] flex flex-wrap items-center gap-[10px] rounded-[3px] border border-dashed border-[#e87722] bg-[#fff6ee] px-[16px] py-[10px] text-[13px] text-[#2e3a43] print:hidden">
    <CalendarClock size={18} className="text-[#e87722]" />
    <span><b>Training clock:</b> today is <b>{state.simDate}</b></span>
    <span className="text-[#5c6670]">Advance time to run bills, late fees, notices and renewals:</span>
    {[1, 7, 15, 30].map((days) => <button key={days} type="button" onClick={() => advance(days)} className={chip}>+{days} day{days > 1 ? 's' : ''}</button>)}
    {state.policies.length > 0 && <button type="button" onClick={() => { if (window.confirm('Delete every training policy and its history from this browser?')) clearPolicies(); }} className={`ml-auto flex items-center gap-1 text-[12px] font-bold text-[#c8102e] underline ${focusable}`}><Trash2 size={13} />Clear training policies</button>}
    {notice && <span role="status" className="flex w-full items-center gap-1 text-[12px] font-medium text-[#0b5d3f]"><Clock3 size={13} />{notice}</span>}
  </div>;
}

export function ServiceLayout({ customer, nav, children, back }: { customer?: { name: string; phone: string; email: string }; nav?: ReactNode; children: ReactNode; back?: { label: string; onClick: () => void } }) {
  const { showDashboard } = useQuote();
  return <div className="flex h-screen flex-col bg-[#f1f6f9] text-[#2e3a43] print:block print:h-auto print:bg-white">
    <ServiceHeader customer={customer} />
    <div className="flex min-h-0 flex-1 print:block">
      {nav}
      <main className="min-w-0 flex-1 overflow-auto print:overflow-visible"><div className="px-[20px] pt-[20px]">{children}</div><PageLinks /></main>
    </div>
    <div className="flex h-[57px] shrink-0 items-center justify-end gap-[11px] border-t border-[#d7dfe4] bg-white px-[15px] shadow-[0_-2px_5px_rgba(0,0,0,.05)] print:hidden">
      {back && <button type="button" onClick={back.onClick} className={outlineButton}><ArrowLeft size={16} strokeWidth={2.4} />{back.label}</button>}
      <button type="button" onClick={showDashboard} className={solidButton}>Return to Dashboard</button>
    </div>
  </div>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = { Active: 'bg-[#e6f4ef] text-[#0b5d3f]', 'Pending Cancel': 'bg-[#fdf0f1] text-[#c8102e]', Cancelled: 'bg-[#eceff1] text-[#52616c]', Expired: 'bg-[#eceff1] text-[#52616c]', 'Non-Renewed': 'bg-[#fff6ee] text-[#9a4a0b]' };
  return <span className={`inline-block rounded-full px-[10px] py-[2px] text-[11px] font-bold uppercase tracking-[.3px] ${tone[status] ?? 'bg-[#e8f4fa] text-[#0073cf]'}`}>{status}</span>;
}
