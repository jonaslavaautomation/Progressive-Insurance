import { AlertTriangle, CheckCircle2, Printer } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { LAST_STEP, STEPS } from '@/context/quoteStore';
import { incompleteSteps } from '@/utils/validation';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { QuoteSheet } from '@/components/quote/QuoteSheet';

export function FinalSaleStep() {
  const { state, bindPolicy, goToStep, showDashboard, resetQuote } = useQuote();
  const incomplete = incompleteSteps(state).filter((step) => step < LAST_STEP);
  const bound = Boolean(state.policy.policyNumber);
  const startNew = () => { if (window.confirm('Start a new quote? This policy will be cleared from the simulator.')) { resetQuote(); goToStep(0); } };

  return <WizardLayout>
    <div className="mx-4 space-y-3 print:m-0">
      {incomplete.length > 0 && <div role="alert" className="rounded border border-[#c8102e] bg-[#fdf0f1] px-3 py-2 text-[11px] print:hidden"><div className="flex items-center gap-2 font-bold text-[#c8102e]"><AlertTriangle size={14} /> The policy cannot be bound until these steps are complete:</div><ul className="mt-1 flex flex-wrap gap-2 pl-6">{incomplete.map((step) => <li key={step}><button type="button" onClick={() => goToStep(step)} className="font-bold text-[#003865] underline">{STEPS[step]}</button></li>)}</ul></div>}
      {bound && <div className="flex items-center gap-2 rounded border border-[#07866f] bg-[#e6f4ef] px-3 py-2 text-[11px] font-bold text-[#05784c] print:hidden"><CheckCircle2 size={16} /> Policy {state.policy.policyNumber} bound on {state.policy.boundAt}. Print or save the binder for the customer file.</div>}
      <div className="flex flex-wrap gap-2 print:hidden">
        {!bound && <button type="button" disabled={incomplete.length > 0} onClick={bindPolicy} className="bg-[#0073cf] px-4 py-2 text-[10px] font-bold text-white shadow hover:bg-[#005da8] disabled:cursor-not-allowed disabled:bg-[#9fb9cf]">BIND POLICY</button>}
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 border-2 border-[#0073cf] bg-white px-4 py-2 text-[10px] font-bold text-[#003865] hover:bg-[#e8f4fa]"><Printer size={13} /> DOWNLOAD / PRINT QUOTE PDF</button>
        {bound && <><button type="button" onClick={showDashboard} className="border-2 border-[#0073cf] bg-white px-4 py-2 text-[10px] font-bold text-[#003865] hover:bg-[#e8f4fa]">RETURN TO DASHBOARD</button><button type="button" onClick={startNew} className="border-2 border-[#0073cf] bg-white px-4 py-2 text-[10px] font-bold text-[#003865] hover:bg-[#e8f4fa]">START NEW QUOTE</button></>}
      </div>
      <QuoteSheet />
    </div>
  </WizardLayout>;
}
