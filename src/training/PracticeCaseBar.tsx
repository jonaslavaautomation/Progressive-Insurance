// Practice-case bar in the personal quote wizard: links the intake form and grades the quote.
import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileText, XCircle } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { useStepValidation } from '@/components/wizard/stepValidation';
import { formatCurrency } from '@/utils/masks';
import { checkPracticeQuote, practiceCase } from '@/training/homeCases';

const COVERAGES_STEP = 4;
const focus = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';

export function PracticeCaseBar() {
  const { state } = useQuote();
  const { errors, show } = useStepValidation();
  const [checked, setChecked] = useState(false);
  const kase = practiceCase(state.policy.trainingCase);
  if (!kase) return null;
  const grading = state.ui.step >= COVERAGES_STEP;
  // Trying to continue with a wrong premium opens the result automatically.
  const blocked = show && !!errors['training.check'];
  const result = grading && (checked || blocked) ? checkPracticeQuote(state, kase) : null;
  return <section id="training.check" tabIndex={-1} aria-label={`Practice case ${kase.id}`} className="mx-[20px] mt-[16px] max-w-[880px] rounded-[3px] border border-[#0073cf] bg-[#f3f8fc] outline-none">
    <div className="flex flex-wrap items-center gap-x-[16px] gap-y-2 px-[16px] py-[10px] text-[13.5px]">
      <ClipboardCheck size={20} className="shrink-0 text-[#003865]" />
      <span><b>Practice case {kase.title}</b><span className="block text-[12px] text-[#5c6670]">Quote it exactly as the intake form says, then check your premium.</span></span>
      <a href={kase.pdf} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 font-bold text-[#0073cf] underline ${focus}`}><FileText size={15} />Open Intake Form (PDF)</a>
      {grading && <button type="button" onClick={() => setChecked(true)} className={`ml-auto h-[34px] rounded-[3px] bg-[#003865] px-[14px] text-[12px] font-bold uppercase text-white hover:bg-[#0073cf] ${focus}`}>Check My Quote</button>}
    </div>
    {result && <div className="border-t border-[#cfdbe3] px-[16px] py-[12px] text-[13.5px]" role={result.correct ? 'status' : 'alert'}>
      {!result.rated ? <p className="font-bold text-[#8e1245]">Click RECALCULATE to rate the quote, then check it again.</p>
        : result.correct ? <div className="flex items-start gap-2 text-[#0b5d3f]"><CheckCircle2 size={20} className="shrink-0" /><div><b>Correct!</b> Total {kase.product === 'homeowners' ? 'Homeowners' : ''} Premium <b>{formatCurrency(result.premium)}</b> matches case {kase.id}{result.scenario ? ` (${result.scenario})` : ''}.
            {kase.alternatives?.liability && result.scenario.includes('300,000') && <span className="block text-[#2e3a43]">Next task: re-quote with $500,000 liability and compare the premium.</span>}</div></div>
        : <div className="flex items-start gap-2"><XCircle size={20} className="shrink-0 text-[#c8102e]" /><div>
            <p className="font-bold text-[#c8102e]">Incorrect premium. Your Total Premium is {formatCurrency(result.premium)}, which does not match the correct premium for case {kase.id}.</p>
            {result.problems.length > 0 ? <><p className="mt-1">Review these entries against the intake form, fix them, click RECALCULATE and check again:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{result.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul></>
              : <p className="mt-1">Every graded entry matches. Ask your trainer to confirm the insurance score setting in Trainer Mode.</p>}
            {state.trainerMode && <p className="mt-2 rounded-[3px] bg-[#fff6ee] px-2 py-1 text-[12.5px] text-[#9a4a0b]">Trainer view: the correct premium is {formatCurrency(result.expected)}.</p>}
          </div></div>}
      {result.rated && result.notes.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12.5px] text-[#9a4a0b]">{result.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
    </div>}
  </section>;
}
