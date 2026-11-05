// Training Center: the practice quote cases a VA can open and quote.
import { ClipboardCheck, FileText } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import type { StateName } from '@/data/states';
import { PRACTICE_CASES } from '@/training/homeCases';

const focus = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';

export function PracticeCases() {
  const { state, startQuote } = useQuote();
  const inProgress = !state.policy.policyNumber && (state.ui.maxStep > 0 || !!(state.insured.firstName || state.insured.lastName));
  const start = (id: string, product: (typeof PRACTICE_CASES)[number]['product'], quoteState: string) => {
    if (inProgress && !window.confirm('Start the practice quote? The quote in progress will be discarded.')) return;
    startQuote([product], { quoteState: quoteState as StateName, trainingCase: id });
  };
  return <section aria-labelledby="practice-cases" className="mt-5 max-w-[980px] rounded-[3px] border border-[#cfdbe3] p-4">
    <h2 id="practice-cases" className="flex items-center gap-2 text-[15px] font-bold text-[#003865]"><ClipboardCheck size={18} />Practice Quote Cases</h2>
    <p className="mt-1 text-[13px] leading-[19px] text-[#2e3a43]">Open the intake form, start the practice quote and enter everything exactly as the form says. On Coverages/Bill Plans click <b>RECALCULATE</b>, then <b>CHECK MY QUOTE</b>. A wrong premium shows which entries to review, and the quote cannot continue until the premium is correct.</p>
    <ul className="mt-3 grid grid-cols-2 gap-4">{PRACTICE_CASES.map((kase) => <li key={kase.id} className="rounded-[3px] border border-[#cfdbe3] bg-[#f6f9fb] p-3 text-[13px]">
      <div className="font-bold text-[#003865]">{kase.title}</div>
      <p className="mt-1 leading-[18px] text-[#5c6670]">{kase.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a href={kase.pdf} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 font-bold text-[#0073cf] underline ${focus}`}><FileText size={15} />Open Intake Form (PDF)</a>
        <button type="button" onClick={() => start(kase.id, kase.product, kase.quoteState)} className={`h-[34px] rounded-[3px] bg-[#0073cf] px-[14px] text-[12px] font-bold uppercase text-white hover:bg-[#003865] ${focus}`}>Start Practice Quote</button>
      </div>
    </li>)}</ul>
  </section>;
}
