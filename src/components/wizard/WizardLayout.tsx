// Wizard chrome matching the FAO quote screens: fixed 60px header, fixed 200px stepper,
// fixed 57px action bar, and a scrolling content pane between them.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronDown, Lightbulb, Menu } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { LAST_STEP, STEPS } from '@/context/quoteStore';
import { incompleteSteps, validateStep } from '@/utils/validation';
import { stepHints } from '@/data/trainingHints';
import { StepValidationContext } from '@/components/wizard/stepValidation';
import { DoneCheck } from '@/components/wizard/primitives';

const focusable = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';

export function Logo({ className = 'text-[19px]' }: { className?: string }) {
  return <span className={`whitespace-nowrap font-light tracking-[-.4px] ${className}`}>FOR<b className="font-bold">AGENTS</b>ONLY</span>;
}

function HeaderItem({ label, value }: { label: string; value: string }) {
  return <div className="mr-[30px] min-w-0"><div className="text-[11px] font-bold uppercase leading-[14px] tracking-[.2px]">{label}</div><div className="mt-[3px] min-h-[20px] truncate font-slab text-[15px] leading-[20px]">{value}</div></div>;
}

function KeyboardToggle() {
  const { state, toggleKeyboardHelp } = useQuote();
  const on = state.ui.keyboardHelp;
  return <div className="flex items-center gap-[10px] text-[12.5px]"><span>Keyboard Access to Help Buttons</span><button type="button" role="switch" aria-checked={on} aria-label="Keyboard Access to Help Buttons" onClick={toggleKeyboardHelp} className={`relative flex h-[26px] w-[54px] items-center rounded-full text-[11px] font-bold transition-colors ${on ? 'bg-[#0f7a52]' : 'bg-[#7b858a]'} ${focusable}`}><span className={`absolute ${on ? 'left-[8px]' : 'right-[7px]'}`}>{on ? 'ON' : 'OFF'}</span><span className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-all ${on ? 'left-[31px]' : 'left-[3px]'}`} /></button></div>;
}

function OptionsMenu() {
  const { state, showDashboard, loadSampleQuote, resetQuote, toggleHints } = useQuote();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const run = (action: () => void) => () => { setOpen(false); action(); };
  const items: [string, () => void][] = [
    ['Return to Dashboard', showDashboard],
    [`Training Hints: ${state.ui.hintMode ? 'ON' : 'OFF'}`, toggleHints],
    ['Load Sample Customer (Jonnie James)', loadSampleQuote],
    ['Start New Quote', () => { if (window.confirm('Discard this quote and start a new one?')) resetQuote(); }],
  ];
  return <div ref={menu} className="relative"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`flex items-center gap-[12px] ${focusable}`}><Menu size={28} strokeWidth={2} /><span className="text-[14px] font-bold underline underline-offset-2">OPTIONS</span><ChevronDown size={18} strokeWidth={2.4} /></button>{open && <ul className="absolute right-0 top-[40px] z-40 w-[260px] overflow-hidden rounded-[3px] border border-[#cfdbe3] bg-white text-[14px] text-[#003865] shadow-[0_4px_14px_rgba(0,0,0,.22)]">{items.map(([label, action]) => <li key={label}><button type="button" onClick={run(action)} className="block w-full border-b border-[#edf1f3] px-4 py-[11px] text-left font-medium hover:bg-[#e8f4fa]">{label}</button></li>)}</ul>}</div>;
}

export function FormHeader({ keyboardToggle = false }: { keyboardToggle?: boolean }) {
  const { state, showDashboard } = useQuote();
  const { insured } = state;
  const name = [insured.firstName, insured.lastName].filter(Boolean).join(' ');
  const phone = insured.phones.find((entry) => entry.number)?.number ?? '';
  return <header className="flex h-[60px] shrink-0 items-center bg-[#003865] pl-[24px] pr-[26px] text-white print:hidden">
    <button type="button" onClick={showDashboard} title="Return to dashboard" className={`w-[195px] shrink-0 text-left ${focusable}`}><Logo /></button>
    {name ? <><HeaderItem label="Customer" value={name} /><HeaderItem label="Phone" value={phone} /><HeaderItem label="Email" value={insured.email} /></> : <HeaderItem label="Product(s) Selected:" value="Auto" />}
    <div className="ml-auto flex shrink-0 items-center gap-[26px]">{keyboardToggle && <KeyboardToggle />}{state.ui.hintMode && <span className="flex items-center gap-1 rounded-full bg-[#e87722] px-2 py-[2px] text-[11px] font-bold"><Lightbulb size={12} /> TRAINING HINTS</span>}<OptionsMenu /></div>
  </header>;
}

function Stepper({ current, maxStep, incomplete, onNavigate }: { current: number; maxStep: number; incomplete: number[]; onNavigate: (step: number) => void }) {
  return <aside className="w-[200px] shrink-0 overflow-y-auto border-r border-[#d0d8de] bg-white pt-[10px] print:hidden"><ol>{STEPS.map((step, index) => {
    const isCurrent = index === current;
    const done = index < maxStep && !isCurrent && !incomplete.includes(index);
    const reachable = index <= maxStep && !isCurrent;
    const strong = isCurrent || done || index <= Math.max(current + 1, 2);
    const text = <span className={`block w-[110px] text-left text-[12.5px] font-bold uppercase leading-[16px] ${strong ? 'text-[#003865]' : 'text-[#5c6670]'} ${done ? 'underline underline-offset-2' : ''}`}>{step}</span>;
    return <li key={step} aria-current={isCurrent ? 'step' : undefined} className={`relative flex items-center justify-between py-[10px] pl-[25px] pr-[23px] ${isCurrent ? 'border-y border-[#d0d8de] bg-white before:absolute before:-bottom-px before:-top-px before:left-0 before:w-[4px] before:bg-[#003865]' : ''}`}>
      {reachable ? <button type="button" onClick={() => onNavigate(index)} className={`hover:underline ${focusable}`}>{text}</button> : text}
      {done ? <DoneCheck /> : <span className={`block h-[17px] w-[17px] rounded-full border-2 bg-white ${strong ? 'border-[#003865]' : 'border-[#5c6670]'}`} />}
    </li>;
  })}</ol></aside>;
}

/** Sticky AUTO / Quote # strip shown on the Products step. */
export function StepHeader() {
  const { state } = useQuote();
  const button = `h-[40px] rounded-[3px] border-2 border-[#0073cf] bg-white px-[15px] text-[12.5px] font-bold text-[#003865] hover:bg-[#e8f4fa] ${focusable}`;
  return <div className="sticky top-0 z-10 flex h-[100px] items-start justify-between bg-[#f1f6f9] px-[20px] pt-[20px] print:hidden">
    <div className="relative flex h-[60px] w-[176px] flex-col items-center justify-center bg-[#003865] text-white"><div className="text-[15px] font-bold leading-[19px]">AUTO</div><div className="text-[13px] leading-[17px]">Quote #: {state.policy.quoteNumber || '—'}</div><span className="absolute -bottom-[9px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[9px] border-x-transparent border-t-[#003865]" /></div>
    <div className="flex gap-[14px]"><button type="button" className={button}>ADD PRODUCTS</button><button type="button" className={button}>SUSPEND PRODUCTS</button></div>
  </div>;
}

function ActionBar({ backLabel, nextLabel, onBack, onNext }: { backLabel?: string; nextLabel?: string; onBack?: () => void; onNext?: () => void }) {
  const base = `flex h-[40px] items-center gap-[8px] rounded-[3px] px-[16px] text-[12.5px] font-bold uppercase ${focusable}`;
  return <div className="flex h-[57px] shrink-0 items-center justify-end gap-[11px] border-t border-[#d7dfe4] bg-white px-[15px] shadow-[0_-2px_5px_rgba(0,0,0,.05)] print:hidden">
    {onBack && backLabel && <button type="button" onClick={onBack} className={`${base} border-2 border-[#0073cf] bg-white text-[#003865] hover:bg-[#e8f4fa]`}><ArrowLeft size={16} strokeWidth={2.4} />{backLabel}</button>}
    {onNext && nextLabel && <button type="button" onClick={onNext} className={`${base} border-2 border-[#0073cf] bg-[#0073cf] text-white hover:border-[#003865] hover:bg-[#003865] focus-visible:border-[#003865] focus-visible:bg-[#003865]`}>{nextLabel}<ArrowRight size={16} strokeWidth={2.4} /></button>}
  </div>;
}

function PageLinks() {
  const links = ['Privacy Statement', 'Terms of Use', 'Contact Us', 'Site Map', 'Do Not Sell or Share My Personal Information (CA Residents Only)'];
  return <footer className="mx-[20px] mb-[18px] mt-[18px] flex max-w-[1070px] flex-wrap items-center gap-x-[8px] gap-y-1 border-t border-[#cfd8de] pt-[14px] text-[11px] text-[#2e3a43] print:hidden">{links.map((link, index) => <span key={link} className="flex items-center gap-[8px]">{index > 0 && <span className="text-[#7b858a]">|</span>}<a href="#" onClick={(event) => event.preventDefault()} className="underline">{link}</a></span>)}<span className="ml-[12px]">Copyright 1997-{new Date().getFullYear()} Progressive Casualty Insurance Company. All rights reserved.</span></footer>;
}

function ValidationSummary({ errors, target, onSelect }: { errors: Record<string, string>; target: string; onSelect: (id: string) => void }) {
  const entries = Object.entries(errors);
  return <div role="alert" className="mb-[20px] max-w-[990px] rounded-[3px] border border-[#c8102e] bg-[#fdf0f1] px-[16px] py-[12px] text-[14px] text-[#2e3a43] print:hidden"><div className="flex items-center gap-2 font-bold text-[#c8102e]"><AlertTriangle size={17} /> Please correct {entries.length} item{entries.length > 1 ? 's' : ''} before continuing to {target}:</div><ul className="mt-[6px] list-disc space-y-[3px] pl-[26px]">{entries.map(([id, message]) => <li key={id}><button type="button" onClick={() => onSelect(id)} className="text-left underline decoration-[#c8102e]/40 underline-offset-2 hover:text-[#c8102e]">{message}</button></li>)}</ul></div>;
}

function StepHint({ step }: { step: number }) {
  return <div className="mb-[20px] flex max-w-[990px] items-start gap-2 rounded-[3px] border border-[#f5a45d] bg-[#fff6ee] px-[16px] py-[10px] text-[14px] leading-[19px] text-[#2e3a43] print:hidden"><Lightbulb size={18} className="mt-px shrink-0 text-[#e87722]" fill="#fde3cc" /><span><b>Training Hint:</b> {stepHints[step]}</span></div>;
}

function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) return false;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
  return true;
}

export function WizardLayout({ children, stepHeader = false, keyboardToggle = false, contentClassName = 'pt-[30px]', onRevealField }: { children: ReactNode; stepHeader?: boolean; keyboardToggle?: boolean; contentClassName?: string; onRevealField?: (id: string) => void }) {
  const { state, goToStep } = useQuote();
  const { step, maxStep, hintMode } = state.ui;
  const errors = useMemo(() => validateStep(step, state), [step, state]);
  const incomplete = useMemo(() => incompleteSteps(state), [state]);
  const [showErrors, setShowErrors] = useState(false);
  const main = useRef<HTMLElement>(null);
  const errorCount = Object.keys(errors).length;

  useEffect(() => { main.current?.scrollTo(0, 0); }, []);

  const leave = (target: number) => {
    // Moving backward never blocks; moving forward requires the current step to be valid.
    if (target > step && errorCount) { setShowErrors(true); main.current?.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    goToStep(target);
  };

  const selectError = (id: string) => {
    if (focusField(id)) return;
    // The field may belong to a vehicle/driver that isn't on screen; let the step reveal it first.
    onRevealField?.(id);
    window.setTimeout(() => focusField(id), 50);
  };

  return <StepValidationContext.Provider value={{ errors, show: showErrors }}>
    <div className="flex h-screen flex-col bg-[#f1f6f9] text-[#2e3a43] print:block print:h-auto print:bg-white">
      <FormHeader keyboardToggle={keyboardToggle} />
      <div className="flex min-h-0 flex-1 print:block">
        <Stepper current={step} maxStep={maxStep} incomplete={incomplete} onNavigate={leave} />
        <main ref={main} className="min-w-0 flex-1 overflow-auto print:overflow-visible">
          {stepHeader && <StepHeader />}
          <div className={`px-[20px] print:p-0 ${contentClassName}`}>
            {hintMode && <StepHint step={step} />}
            {showErrors && errorCount > 0 && <ValidationSummary errors={errors} target={STEPS[step + 1] ?? 'the next step'} onSelect={selectError} />}
            {children}
          </div>
          <PageLinks />
        </main>
      </div>
      <ActionBar backLabel={STEPS[step - 1]} nextLabel={STEPS[step + 1]} onBack={step > 0 ? () => leave(step - 1) : undefined} onNext={step < LAST_STEP ? () => leave(step + 1) : undefined} />
    </div>
  </StepValidationContext.Provider>;
}
