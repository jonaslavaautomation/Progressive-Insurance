// Shared wizard chrome: header, stepper, step header, footer and validation plumbing.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Lightbulb, Menu } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { LAST_STEP, STEPS } from '@/context/quoteStore';
import { incompleteSteps, validateStep } from '@/utils/validation';
import { stepHints } from '@/data/trainingHints';
import { StepValidationContext } from '@/components/wizard/stepValidation';

function HeaderItem({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  return <div className={`${first ? '' : 'ml-3 '}border-l border-white/40 pl-4 text-[9px] font-bold uppercase`}><div>{label}</div><div className="min-h-[14px] text-[11px] normal-case">{value}</div></div>;
}

function OptionsMenu() {
  const { showDashboard, loadSampleQuote, resetQuote } = useQuote();
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => { setOpen(false); action(); };
  const items: [string, () => void][] = [
    ['Return to Dashboard', showDashboard],
    ['Load Sample Customer (Jonnie James)', loadSampleQuote],
    ['Start New Quote', () => { if (window.confirm('Discard this quote and start a new one?')) resetQuote(); }],
  ];
  return <div className="relative"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-3"><Menu size={22} /><span className="font-bold underline">OPTIONS</span><ChevronDown size={13} /></button>{open && <ul className="absolute right-0 top-[30px] z-30 w-[230px] overflow-hidden rounded border border-[#c6d6e1] bg-white text-[11px] text-[#003865] shadow-lg">{items.map(([label, action]) => <li key={label}><button type="button" onClick={run(action)} className="block w-full border-b border-[#edf1f3] px-3 py-2 text-left font-semibold hover:bg-[#e8f4fa]">{label}</button></li>)}</ul>}</div>;
}

export function FormHeader() {
  const { state, toggleHints, showDashboard } = useQuote();
  const { insured, ui } = state;
  const name = [insured.firstName, insured.lastName].filter(Boolean).join(' ');
  const phone = insured.phones.find((entry) => entry.number)?.number ?? '';
  return <header className="flex h-[46px] items-center bg-[#003865] px-3 text-white print:hidden"><button type="button" onClick={showDashboard} title="Return to dashboard" className="w-[125px] whitespace-nowrap text-left text-[15px] font-light tracking-[-.7px]">FOR <b>AGENTSONLY</b></button>{name ? <><HeaderItem first label="CUSTOMER" value={name} /><HeaderItem label="PHONE" value={phone} /><HeaderItem label="EMAIL" value={insured.email} /></> : <div className="border-l border-white/40 pl-4 text-[9px] font-bold uppercase"><div>PRODUCT(S) SELECTED:</div><div className="text-[11px] normal-case">Auto</div></div>}<div className="ml-auto flex items-center gap-3 text-[9px]"><span>Keyboard Access to Help Buttons</span><span className="rounded-full bg-white px-2 py-0.5 font-bold text-[#05784c]">ON</span><button type="button" onClick={toggleHints} aria-pressed={ui.hintMode} className="ml-2 flex items-center gap-2"><Lightbulb size={13} className="text-[#f5a45d]" /><span>Training Hints</span><span className={`rounded-full px-2 py-0.5 font-bold ${ui.hintMode ? 'bg-white text-[#05784c]' : 'border border-white/60 text-white'}`}>{ui.hintMode ? 'ON' : 'OFF'}</span></button><OptionsMenu /></div></header>;
}

function Stepper({ current, maxStep, incomplete, onNavigate }: { current: number; maxStep: number; incomplete: number[]; onNavigate: (step: number) => void }) {
  return <aside className="w-[130px] shrink-0 border-r border-[#d0d8de] bg-white px-2 py-2 text-[#003865] print:hidden"><ol className="space-y-4">{STEPS.map((step, index) => {
    const done = index < maxStep && index !== current && !incomplete.includes(index);
    const reachable = index <= maxStep && index !== current;
    return <li key={step} className={`flex items-start gap-2 text-[10px] font-bold leading-[1.1] ${index === current ? 'text-[#003865]' : 'text-[#52616c]'}`}><span className="mt-0.5 h-[13px] w-[13px] shrink-0">{done ? <CheckCircle2 size={13} className="text-[#07866f]" fill="#07866f" color="white" /> : <span className={`block h-[13px] w-[13px] rounded-full border-2 ${index === current ? 'border-[#003865] bg-[#003865]' : 'border-[#7b858a] bg-white'}`} />}</span>{reachable ? <button type="button" onClick={() => onNavigate(index)} className={`text-left font-bold text-[#003865] hover:underline ${done ? 'underline' : ''}`}>{step}</button> : step}</li>;
  })}</ol></aside>;
}

export function StepHeader() {
  const { state } = useQuote();
  return <div className="flex min-h-[68px] items-start justify-between bg-[#edf4f8] px-4 py-4 print:hidden"><div className="relative mt-0.5 bg-[#003865] px-5 py-3 text-center text-white shadow-sm"><div className="text-[16px] font-bold">AUTO</div><div className="text-[9px]">Quote #: {state.policy.quoteNumber || '—'}</div><span className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[9px] border-x-transparent border-t-[#003865]" /></div><div className="flex gap-2"><button className="border-2 border-[#0073cf] bg-white px-4 py-2 text-[10px] font-bold text-[#003865] hover:bg-[#e8f4fa]">ADD PRODUCTS</button><button className="border-2 border-[#0073cf] bg-white px-4 py-2 text-[10px] font-bold text-[#003865] hover:bg-[#e8f4fa]">SUSPEND PRODUCTS</button></div></div>;
}

function WizardFooter({ backLabel, nextLabel, onBack, onNext }: { backLabel?: string; nextLabel?: string; onBack?: () => void; onNext?: () => void }) { return <div className="fixed bottom-0 left-0 right-0 z-20 flex h-[42px] items-center justify-between border-t border-[#d7dfe4] bg-white px-4 print:hidden"><div className="text-[8px] text-[#53616a]">Privacy Statement &nbsp; | &nbsp; Terms of Use &nbsp; | &nbsp; Contact Us &nbsp; | &nbsp; Site Map &nbsp; | &nbsp; Do Not Sell or Share My Personal Information</div><div className="flex gap-2">{onBack && backLabel && <button onClick={onBack} className="border-2 border-[#0073cf] bg-white px-4 py-2 text-[10px] font-bold text-[#003865] hover:bg-[#e8f4fa]">← {backLabel}</button>}{onNext && nextLabel && <button onClick={onNext} className="bg-[#0073cf] px-4 py-2 text-[10px] font-bold text-white shadow hover:bg-[#005da8]">{nextLabel} →</button>}</div></div>; }

function ValidationSummary({ errors, target, className, onSelect }: { errors: Record<string, string>; target: string; className: string; onSelect: (id: string) => void }) {
  const entries = Object.entries(errors);
  return <div role="alert" className={`${className} rounded border border-[#c8102e] bg-[#fdf0f1] px-3 py-2 text-[11px] text-[#28343c] print:hidden`}><div className="flex items-center gap-2 font-bold text-[#c8102e]"><AlertTriangle size={14} /> Please correct {entries.length} item{entries.length > 1 ? 's' : ''} before continuing to {target}:</div><ul className="mt-1 list-disc space-y-0.5 pl-6">{entries.map(([id, message]) => <li key={id}><button type="button" onClick={() => onSelect(id)} className="text-left underline decoration-[#c8102e]/40 underline-offset-2 hover:text-[#c8102e]">{message}</button></li>)}</ul></div>;
}

function StepHint({ step, className }: { step: number; className: string }) {
  return <div className={`${className} flex items-start gap-2 rounded border border-[#f5a45d] bg-[#fff6ee] px-3 py-2 text-[11px] leading-snug text-[#28343c] print:hidden`}><Lightbulb size={15} className="mt-px shrink-0 text-[#e87722]" fill="#fde3cc" /><span><b>Training Hint:</b> {stepHints[step]}</span></div>;
}

function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) return false;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
  return true;
}

export function WizardLayout({ children, showStepHeader = true, onRevealField }: { children: ReactNode; showStepHeader?: boolean; onRevealField?: (id: string) => void }) {
  const { state, goToStep } = useQuote();
  const { step, maxStep, hintMode } = state.ui;
  const errors = useMemo(() => validateStep(step, state), [step, state]);
  const incomplete = useMemo(() => incompleteSteps(state), [state]);
  const [showErrors, setShowErrors] = useState(false);
  const errorCount = Object.keys(errors).length;

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const leave = (target: number) => {
    // Moving backward never blocks; moving forward requires the current step to be valid.
    if (target > step && errorCount) { setShowErrors(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    goToStep(target);
  };

  const selectError = (id: string) => {
    if (focusField(id)) return;
    // The field may belong to a vehicle/driver that isn't on screen; let the step reveal it first.
    onRevealField?.(id);
    window.setTimeout(() => focusField(id), 50);
  };

  const gutter = showStepHeader ? 'mx-4 mb-3' : 'mx-3 mt-3';
  return <StepValidationContext.Provider value={{ errors, show: showErrors }}>
    <div className="min-h-screen bg-[#edf4f8] text-[#28343c]"><FormHeader /><div className="flex min-h-[calc(100vh-46px)]"><Stepper current={step} maxStep={maxStep} incomplete={incomplete} onNavigate={leave} /><main className="min-w-0 flex-1 overflow-y-auto pb-14 print:pb-0">{showStepHeader && <StepHeader />}{hintMode && <StepHint step={step} className={gutter} />}{showErrors && errorCount > 0 && <ValidationSummary errors={errors} target={STEPS[step + 1] ?? 'the next step'} className={gutter} onSelect={selectError} />}{children}</main></div><WizardFooter backLabel={STEPS[step - 1]} nextLabel={STEPS[step + 1]} onBack={step > 0 ? () => leave(step - 1) : undefined} onNext={step < LAST_STEP ? () => leave(step + 1) : undefined} /></div>
  </StepValidationContext.Provider>;
}
