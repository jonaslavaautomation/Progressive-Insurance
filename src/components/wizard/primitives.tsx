// Carrier form controls. Class strings are carried over from the original static prototype;
// the controls are now controlled inputs with focus/error states driven by real UI state.
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Lightbulb, Plus, X } from 'lucide-react';
import type { Option } from '@/data/options';
import { applyMask, type Mask } from '@/utils/masks';
import { useQuote } from '@/context/useQuote';
import { inlineMessage, useFieldError } from '@/components/wizard/stepValidation';

export const focusRing = 'focus:border-[#f26722] focus:shadow-[inset_0_0_0_1px_#f26722,0_0_0_1px_#0073cf]';
export const errorRing = 'border-[#c8102e] shadow-[inset_0_0_0_1px_#c8102e]';

function optionValue(option: Option) { return typeof option === 'string' ? option : option.value; }
function optionLabel(option: Option) { return typeof option === 'string' ? option : option.label; }

export function HelpDot() { return <HelpCircle size={14} className="shrink-0 text-[#8e3199]" fill="#8e3199" color="white" />; }
export function MoneyTag() { return <span className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[#07866f] text-[9px] font-bold text-white">$</span>; }

/** Trainer note icon, only rendered while Training Hints are on. */
export function HintBubble({ text }: { text?: string }) {
  const { state } = useQuote();
  const ref = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  if (!state.ui.hintMode || !text) return null;
  const open = () => setRect(ref.current?.getBoundingClientRect() ?? null);
  const close = () => setRect(null);
  return <span ref={ref} tabIndex={0} role="button" aria-label="Training hint" onMouseEnter={open} onMouseLeave={close} onFocus={open} onBlur={close} onClick={(event) => { event.preventDefault(); if (rect) close(); else open(); }} className="inline-flex shrink-0 cursor-help rounded-full outline-none focus:ring-2 focus:ring-[#e87722]">
    <Lightbulb size={14} className="text-[#e87722]" fill="#fde3cc" />
    {rect && createPortal(<div role="tooltip" style={{ position: 'fixed', left: Math.max(8, Math.min(rect.left - 12, window.innerWidth - 292)), top: rect.bottom + 8, width: 280 }} className="z-[100] rounded border-l-4 border-[#e87722] bg-[#003865] px-3 py-2 text-[12px] leading-snug text-white shadow-lg"><div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f5a45d]">Trainer note</div>{text}</div>, document.body)}
  </span>;
}

export function InlineError({ message }: { message?: string }) {
  if (!message) return null;
  return <span role="alert" className="mt-0.5 block text-[9px] font-semibold leading-tight text-[#c8102e]">{inlineMessage(message)}</span>;
}

interface FieldBase { id?: string; label: string; help?: boolean; hint?: string; tag?: boolean; disabled?: boolean; error?: string }

// ---------------------------------------------------------------- Named Insured layout

export function FormInput({ id, label, required = false, value, onChange, placeholder = '', className = '', disabled = false, mask, hint, type = 'text' }: { id?: string; label: string; required?: boolean; value: string; onChange?: (value: string) => void; placeholder?: string; className?: string; disabled?: boolean; mask?: Mask; hint?: string; type?: string }) {
  const error = useFieldError(id);
  return <label className={`flex items-center gap-3 text-[10px] text-[#28343c] ${className}`}><span className="flex w-[130px] shrink-0 items-center gap-1">{label}{required && <b>*</b>}<HintBubble text={hint} /></span><span className="min-w-0 flex-1"><input id={id} type={type} value={value} disabled={disabled} aria-invalid={!!error} onChange={(event) => onChange?.(applyMask(mask, event.target.value))} placeholder={placeholder} className={`h-[27px] w-full min-w-0 rounded border px-2 text-[11px] outline-none ${disabled ? 'bg-[#f2f2f2] text-[#879198]' : 'bg-white'} ${error ? errorRing : 'border-[#aab2b7]'} ${focusRing}`} /><InlineError message={error} /></span></label>;
}

export function FormSelect({ id, label, value, onChange, options, required = false, className = '', hint }: { id?: string; label: string; value: string; onChange: (value: string) => void; options: readonly Option[]; required?: boolean; className?: string; hint?: string }) {
  const error = useFieldError(id);
  return <label className={`flex items-center gap-3 text-[10px] text-[#28343c] ${className}`}><span className="flex w-[130px] shrink-0 items-center gap-1"><span>{label}{required && <b>*</b>}</span><HintBubble text={hint} /></span><span className="min-w-0 flex-1"><select id={id} value={value} aria-invalid={!!error} onChange={(event) => onChange(event.target.value)} className={`h-[27px] w-full min-w-0 rounded border bg-white px-2 text-[11px] outline-none ${error ? errorRing : 'border-[#aab2b7]'} ${focusRing}`}><option value="" />{options.map((option) => <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>)}</select><InlineError message={error} /></span></label>;
}

export function FormSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) { return <section className={`overflow-hidden rounded border border-[#cad9e4] bg-white ${className}`}><h2 className="border-b border-[#cad9e4] bg-[#e5eef5] px-3 py-2 text-[13px] font-bold text-[#28343c]">{title}</h2><div className="space-y-2 p-3">{children}</div></section>; }

// ---------------------------------------------------------------- Wizard (Products onward) layout

function WizardLabel({ label, help, hint, tag }: Pick<FieldBase, 'label' | 'help' | 'hint' | 'tag'>) {
  return <span className="flex min-w-0 flex-1 items-center gap-2">{label}{help && <HelpDot />}{tag && <MoneyTag />}<HintBubble text={hint} /></span>;
}

export function WizardField({ id, label, help = false, hint, tag = false, money = false, placeholder = '', value, onChange, onBlur, disabled = false, mask, icon, error: explicitError }: FieldBase & { money?: boolean; placeholder?: string; value: string; onChange?: (value: string) => void; onBlur?: () => void; mask?: Mask; icon?: ReactNode }) {
  const error = useFieldError(id, explicitError);
  return <label className="flex min-h-[28px] items-center gap-2 border-b border-[#edf1f3] px-3 py-1 text-[10px] text-[#28343c]"><WizardLabel label={label} help={help} hint={hint} tag={tag || money} /><span className="relative w-[184px] shrink-0">{money && <span className="absolute left-2 top-1.5 text-[11px] text-[#68747a]">$</span>}{mask === 'date' && value && <span className="pointer-events-none absolute -top-[5px] left-2 bg-white px-0.5 text-[8px] leading-none text-[#28343c]">MM/DD/YYYY</span>}<input id={id} disabled={disabled} value={value} aria-invalid={!!error} onChange={(event) => onChange?.(applyMask(mask, event.target.value))} onBlur={onBlur} placeholder={placeholder} className={`h-[27px] w-full rounded border px-2 text-[11px] outline-none ${money ? 'pl-5' : ''} ${icon ? 'pr-7' : ''} ${disabled ? 'bg-[#f2f2f2] text-[#879198]' : 'bg-white'} ${error ? errorRing : 'border-[#9fa7ab]'} ${focusRing}`} />{icon && <span className="absolute right-2 top-1.5 text-[#68747a]">{icon}</span>}<InlineError message={error} /></span></label>;
}

export function WizardSelect({ id, label, help = false, hint, tag = false, disabled = false, options, value, onChange, error: explicitError, placeholder = '' }: FieldBase & { options: readonly Option[]; value: string; onChange?: (value: string) => void; placeholder?: string }) {
  const error = useFieldError(id, explicitError);
  const hasValue = options.some((option) => optionValue(option) === value);
  return <label className="flex min-h-[28px] items-center gap-2 border-b border-[#edf1f3] px-3 py-1 text-[10px] text-[#28343c]"><WizardLabel label={label} help={help} hint={hint} tag={tag} /><span className="w-[184px] shrink-0"><select id={id} disabled={disabled} value={value} aria-invalid={!!error} onChange={(event) => onChange?.(event.target.value)} className={`h-[27px] w-full rounded border px-2 text-[11px] outline-none ${disabled ? 'bg-[#f2f2f2] text-[#879198]' : 'bg-white'} ${error ? errorRing : 'border-[#9fa7ab]'} ${focusRing}`}>{!hasValue && <option value={value}>{value || placeholder}</option>}{hasValue && !disabled && <option value="">{placeholder}</option>}{options.map((option) => <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>)}</select><InlineError message={error} /></span></label>;
}

export function WizardRadio({ id, label, name, value, onChange, help = false, hint, className = 'flex min-h-[32px] items-center gap-4 border-b border-[#edf1f3] px-3 text-[10px]' }: { id?: string; label: string; name: string; value: string; onChange: (value: 'Yes' | 'No') => void; help?: boolean; hint?: string; className?: string }) {
  const error = useFieldError(id);
  return <div id={id} tabIndex={-1} className={`${className} ${error ? 'rounded shadow-[inset_0_0_0_1px_#c8102e]' : ''}`}><span className="flex flex-1 flex-col"><span className="flex items-center gap-2">{label} {help && <HelpDot />}<HintBubble text={hint} /></span><InlineError message={error} /></span>{(['Yes', 'No'] as const).map((option) => <label key={option} className="flex items-center gap-1"><input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} /> {option}</label>)}</div>;
}

export function WizardCheckbox({ id, label, checked, onChange }: { id?: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const error = useFieldError(id);
  return <label className="flex min-h-[32px] items-start gap-2 border-b border-[#edf1f3] px-3 py-2 text-[10px] text-[#28343c]"><input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 accent-[#0073cf]" /><span>{label}<InlineError message={error} /></span></label>;
}

export function RemoveButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={disabled ? 'This item cannot be removed' : label} disabled={disabled} onClick={onClick} className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#68747a] text-white hover:bg-[#c8102e] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#68747a]"><X size={11} strokeWidth={3} /></button>;
}

export function WizardCard({ title, subtitle, children, className = '', onRemove, removeLabel = 'Remove', removeDisabled = false }: { title: string; subtitle?: ReactNode; children: ReactNode; className?: string; onRemove?: () => void; removeLabel?: string; removeDisabled?: boolean }) {
  return <section className={`overflow-hidden rounded border border-[#c6d6e1] bg-white ${className}`}><div className="flex min-h-[40px] items-center justify-between border-b border-[#c6d6e1] bg-[#e3edf4] px-3 py-2"><h2 className="text-[14px] font-bold text-[#28343c]">{title}</h2>{(subtitle || onRemove) && <span className="flex items-center gap-3"><span className="text-[11px] font-bold leading-tight text-[#28343c]">{subtitle}</span>{onRemove && <RemoveButton label={removeLabel} onClick={onRemove} disabled={removeDisabled} />}</span>}</div>{children}</section>;
}

/** Big outlined "ADD …" button used in the household side cards. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="m-5 flex h-[62px] w-[calc(100%-40px)] items-center justify-center gap-3 border-2 border-[#0073cf] bg-white text-[13px] font-bold text-[#003865] hover:bg-[#e8f4fa]"><Plus className="rounded-full bg-[#003865] p-1 text-white" size={25} /> {label}</button>;
}

/** Read-only label/value row for review screens. */
export function WizardRow({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return <div className="flex min-h-[28px] items-center justify-between gap-3 border-b border-[#edf1f3] px-3 py-1 text-[10px] text-[#28343c]"><span className="text-[#52616c]">{label}</span><span className={`text-right ${strong ? 'text-[12px] font-bold text-[#003865]' : 'font-semibold'}`}>{value || '—'}</span></div>;
}
