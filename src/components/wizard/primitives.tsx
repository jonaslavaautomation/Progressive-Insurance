// Carrier form controls, sized to the FAO quoting screens (1:1 at a ~1536px viewport):
// 450px two-column cards (225px label / 225px value), 48px rows, 38px x 204px controls.
import type { ReactNode } from 'react';
import { Check, ChevronDown, CirclePlus, Lightbulb, Plus, X } from 'lucide-react';
import type { Option } from '@/data/options';
import { applyMask, type Mask } from '@/utils/masks';
import { useQuote } from '@/context/useQuote';
import { inlineMessage, useFieldError } from '@/components/wizard/stepValidation';
import { Popover } from '@/components/wizard/Floating';
import { useAnchor } from '@/components/wizard/useAnchor';

export const focusRing = 'focus:border-[#003865] focus:shadow-[inset_0_0_0_1px_#003865,0_0_0_2px_#fff,0_0_0_4px_#e87722]';
export const errorRing = 'border-[#c8102e] shadow-[inset_0_0_0_1px_#c8102e]';
const control = 'h-[38px] rounded-[4px] border bg-white text-[14px] text-[#2e3a43] outline-none placeholder:text-[#7b858a]';
const disabledControl = 'disabled:border-[#cdd5db] disabled:bg-[#f2f4f5] disabled:text-[#7b858a]';

function optionValue(option: Option) { return typeof option === 'string' ? option : option.value; }
function optionLabel(option: Option) { return typeof option === 'string' ? option : option.label; }

const GENERIC_HELP = 'Refer to the Product Guide and Reference Cards for detailed underwriting guidance on this field.';

/** Purple "?" help button; opens a floating help panel. */
export function HelpDot({ text, label = 'Help' }: { text?: string; label?: string }) {
  const { state } = useQuote();
  const anchor = useAnchor<HTMLButtonElement>();
  return <>
    <button ref={anchor.ref} type="button" aria-label={label} tabIndex={state.ui.keyboardHelp ? 0 : -1} onClick={(event) => { event.preventDefault(); anchor.toggle(); }} className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#7b2c8f] text-[11px] font-bold leading-none text-white outline-none hover:bg-[#5e1f6e] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]">?</button>
    {anchor.isOpen && <Popover anchor={anchor.ref} title={label} onClose={anchor.close}>{text ?? GENERIC_HELP}</Popover>}
  </>;
}

/** Green price tag: the field can affect price or discounts. */
export function MoneyTag() {
  return <svg aria-label="Affects premium" role="img" width="17" height="17" viewBox="0 0 20 20" className="shrink-0"><path d="M11.2 1.5h6.1c.7 0 1.2.5 1.2 1.2v6.1c0 .3-.1.6-.4.9l-8.4 8.4c-.5.5-1.2.5-1.7 0l-5.9-5.9c-.5-.5-.5-1.2 0-1.7l8.4-8.4c.2-.4.5-.6.7-.6z" fill="#0f7a52" /><circle cx="15" cy="5" r="1.3" fill="#fff" /><text x="9.4" y="13.4" fontSize="8.5" fontWeight="700" fill="#fff" textAnchor="middle" transform="rotate(-45 9.4 11)">$</text></svg>;
}

/** Trainer note icon, only rendered while Training Hints are on (OPTIONS menu). */
export function HintBubble({ text }: { text?: string }) {
  const { state } = useQuote();
  const anchor = useAnchor<HTMLButtonElement>();
  if (!state.ui.hintMode || !text) return null;
  return <>
    <button ref={anchor.ref} type="button" aria-label="Training hint" onClick={(event) => { event.preventDefault(); anchor.toggle(); }} className="inline-flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#e87722]"><Lightbulb size={15} className="text-[#e87722]" fill="#fde3cc" /></button>
    {anchor.isOpen && <Popover anchor={anchor.ref} title="Trainer note" variant="trainer" onClose={anchor.close}>{text}</Popover>}
  </>;
}

export function InlineError({ message }: { message?: string }) {
  if (!message) return null;
  return <span role="alert" className="mt-1 block text-[12px] font-medium leading-[15px] text-[#c8102e]">{inlineMessage(message)}</span>;
}

export function RemoveButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={disabled ? 'This item cannot be removed' : label} disabled={disabled} onClick={onClick} className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-[#6b7780] text-white outline-none hover:bg-[#c8102e] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722] disabled:cursor-not-allowed disabled:hover:bg-[#6b7780]"><X size={11} strokeWidth={3.2} /></button>;
}

function SelectControl({ id, value, options, onChange, disabled, error, placeholder = '', className = 'w-full' }: { id?: string; value: string; options: readonly Option[]; onChange?: (value: string) => void; disabled?: boolean; error?: string; placeholder?: string; className?: string }) {
  const hasValue = options.some((option) => optionValue(option) === value);
  return <span className={`relative block shrink-0 ${className}`}>
    <select id={id} disabled={disabled} value={value} aria-invalid={!!error} onChange={(event) => onChange?.(event.target.value)} className={`wizard-select ${control} ${disabledControl} w-full overflow-hidden pl-[15px] pr-[34px] ${error ? errorRing : 'border-[#7b8a95]'} ${focusRing}`}>
      {!hasValue && <option value={value}>{value || placeholder}</option>}
      {hasValue && !disabled && <option value="">{placeholder}</option>}
      {options.map((option) => <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>)}
    </select>
    <ChevronDown size={19} strokeWidth={2.4} className={`pointer-events-none absolute right-[10px] top-[10px] ${disabled ? 'text-[#a9b2b8]' : 'text-[#003865]'}`} />
  </span>;
}

function TextControl({ id, value, onChange, onBlur, placeholder = '', disabled, error, mask, money, icon, type = 'text', className = 'w-full' }: { id?: string; value: string; onChange?: (value: string) => void; onBlur?: () => void; placeholder?: string; disabled?: boolean; error?: string; mask?: Mask; money?: boolean; icon?: ReactNode; type?: string; className?: string }) {
  return <span className={`relative block shrink-0 ${className}`}>
    {money && <span className={`pointer-events-none absolute left-[15px] top-[9px] text-[14px] ${disabled ? 'text-[#7b858a]' : 'text-[#2e3a43]'}`}>$</span>}
    {mask === 'date' && value && <span className="pointer-events-none absolute -top-[7px] left-[10px] bg-white px-[3px] text-[11px] leading-[12px] text-[#2e3a43]">MM/DD/YYYY</span>}
    <input id={id} type={type} disabled={disabled} value={value} aria-invalid={!!error} onChange={(event) => onChange?.(applyMask(mask, event.target.value))} onBlur={onBlur} placeholder={placeholder} className={`${control} ${disabledControl} w-full ${money ? 'pl-[28px]' : 'pl-[15px]'} ${icon ? 'pr-[34px]' : 'pr-[12px]'} ${error ? errorRing : 'border-[#7b8a95]'} ${focusRing}`} />
    {icon && <span className="absolute right-[11px] top-[10px] text-[#6b7780]">{icon}</span>}
  </span>;
}

// ---------------------------------------------------------------- Named Insured layout

function FormLabel({ label, help, helpText, hint, caption }: { label: string; help?: boolean; helpText?: string; hint?: string; caption?: string }) {
  return <span className="flex w-[215px] shrink-0 items-center gap-2 pr-[4px]"><span className="flex-1"><span className="flex items-center gap-1.5">{label}<HintBubble text={hint} /></span>{caption && <span className="block text-[11px] italic leading-[13px] text-[#5c6670]">{caption}</span>}</span>{help && <HelpDot text={helpText ?? hint} label={label.replace(/[:*]/g, '')} />}</span>;
}

export function FormInput({ id, label, value, onChange, placeholder = '', disabled = false, mask, hint, help = false, helpText, type = 'text' }: { id?: string; label: string; value: string; onChange?: (value: string) => void; placeholder?: string; disabled?: boolean; mask?: Mask; hint?: string; help?: boolean; helpText?: string; type?: string }) {
  const error = useFieldError(id);
  return <div className="flex items-start text-[14px] leading-[18px] text-[#2e3a43]"><label htmlFor={id} className="flex min-h-[38px] items-center"><FormLabel label={label} help={help} helpText={helpText} hint={hint} /></label><span className="w-[318px]"><TextControl id={id} type={type} value={value} disabled={disabled} onChange={onChange} placeholder={placeholder} mask={mask} error={error} /><InlineError message={error} /></span></div>;
}

export function FormSelect({ id, label, value, onChange, options, hint, help = false, helpText }: { id?: string; label: string; value: string; onChange: (value: string) => void; options: readonly Option[]; hint?: string; help?: boolean; helpText?: string }) {
  const error = useFieldError(id);
  return <div className="flex items-start text-[14px] leading-[18px] text-[#2e3a43]"><label htmlFor={id} className="flex min-h-[38px] items-center"><FormLabel label={label} help={help} helpText={helpText} hint={hint} /></label><span className="w-[318px]"><SelectControl id={id} value={value} options={options} onChange={onChange} error={error} /><InlineError message={error} /></span></div>;
}

/** Phone type + number row with its caption, used on Named Insured. */
export function FormPhone({ id, first, type, types, number, onType, onNumber, onRemove, hint }: { id: string; first: boolean; type: string; types: readonly string[]; number: string; onType: (value: string) => void; onNumber: (value: string) => void; onRemove: () => void; hint?: string }) {
  const error = useFieldError(id);
  return <div className="flex items-start text-[14px] leading-[18px] text-[#2e3a43]"><label htmlFor={id} className="flex min-h-[38px] items-center"><FormLabel label={first ? 'Phone Type/Number:*' : 'Additional Phone:'} caption={first ? 'Cell or Home phone required' : undefined} help={first} helpText={hint} /></label><span className="w-[318px]"><span className="flex items-center gap-[8px]"><SelectControl value={type} options={types} onChange={onType} className="w-[83px]" /><TextControl id={id} value={number} onChange={onNumber} placeholder="XXX-XXX-XXXX" mask="phone" error={error} className="w-[170px]" /><RemoveButton label="Remove phone number" onClick={onRemove} /></span><InlineError message={error} /></span></div>;
}

export function FormCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="ml-[215px] flex items-center gap-2 text-[14px] text-[#2e3a43]"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-[18px] w-[18px] rounded-[2px] accent-[#003865]" />{label}</label>;
}

export function FormSection({ title, children, action, className = '' }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`rounded-[3px] border border-[#cfdbe3] bg-white ${className}`}><h2 className="flex min-h-[48px] items-center justify-between rounded-t-[3px] border-b border-[#cfdbe3] bg-[#e4ecf1] px-5 font-slab text-[17px] font-bold text-[#2e3a43]">{title}{action}</h2><div className="space-y-[12px] px-5 py-[16px]">{children}</div></section>;
}

// ---------------------------------------------------------------- Wizard (Products onward) layout

interface RowLabelProps { label: string; help?: boolean; helpText?: string; hint?: string; tag?: boolean; note?: string }

/** Two-column carrier row: 225px label cell (highlighted while its control has focus) + value cell. */
export function WizardRowShell({ htmlFor, label, help, helpText, hint, tag, note, divider = false, children }: RowLabelProps & { htmlFor?: string; divider?: boolean; children: ReactNode }) {
  return <div className={`group flex min-h-[48px] text-[14px] leading-[18px] text-[#2e3a43] ${divider ? 'border-t border-[#d7e0e6]' : ''}`}>
    <label htmlFor={htmlFor} className="flex w-[225px] shrink-0 flex-col justify-center border-r border-[#d7e0e6] py-[5px] pl-[21px] pr-[14px] group-focus-within:bg-[#eef3f6]">
      <span className="flex min-h-[38px] items-center gap-2"><span className="flex flex-1 items-center gap-1.5">{label}<HintBubble text={hint} /></span>{tag && <MoneyTag />}{help && <HelpDot text={helpText ?? hint} label={label.replace(/[:*]/g, '')} />}</span>
      {note && <span className="pb-[6px] pt-[2px] text-[14px]">{note}</span>}
    </label>
    <div className="flex min-w-0 flex-1 flex-col justify-start py-[5px] pl-[10px] pr-[11px]">{children}</div>
  </div>;
}

type WizardFieldProps = RowLabelProps & { id?: string; value: string; onChange?: (value: string) => void; onBlur?: () => void; placeholder?: string; disabled?: boolean; mask?: Mask; money?: boolean; icon?: ReactNode; error?: string; divider?: boolean; narrow?: boolean; after?: ReactNode };

export function WizardField({ id, value, onChange, onBlur, placeholder = '', disabled = false, mask, money = false, icon, error: explicitError, divider, narrow = false, after, ...label }: WizardFieldProps) {
  const error = useFieldError(id, explicitError);
  return <WizardRowShell htmlFor={id} divider={divider} {...label}><span className="flex items-center gap-[18px]"><TextControl id={id} value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder} disabled={disabled} mask={mask} money={money} icon={icon} error={error} className={narrow ? 'w-[180px]' : 'w-[204px]'} />{after}</span><InlineError message={error} /></WizardRowShell>;
}

type WizardSelectProps = RowLabelProps & { id?: string; options: readonly Option[]; value: string; onChange?: (value: string) => void; disabled?: boolean; placeholder?: string; error?: string; divider?: boolean; narrow?: boolean; after?: ReactNode };

export function WizardSelect({ id, options, value, onChange, disabled = false, placeholder = '', error: explicitError, divider, narrow = false, after, ...label }: WizardSelectProps) {
  const error = useFieldError(id, explicitError);
  return <WizardRowShell htmlFor={id} divider={divider} {...label}><span className="flex items-center gap-[10px]"><SelectControl id={id} value={value} options={options} onChange={onChange} disabled={disabled} error={error} placeholder={placeholder} className={narrow ? 'w-[180px]' : 'w-[204px]'} />{after}</span><InlineError message={error} /></WizardRowShell>;
}

export function WizardRadio({ id, name, value, onChange, ...label }: RowLabelProps & { id?: string; name: string; value: string; onChange: (value: 'Yes' | 'No') => void }) {
  const error = useFieldError(id);
  return <WizardRowShell {...label}><span id={id} tabIndex={-1} className={`flex min-h-[38px] items-center gap-[40px] rounded pl-[4px] outline-none ${error ? 'shadow-[inset_0_0_0_1px_#c8102e]' : ''}`}><RadioPair name={name} value={value} onChange={onChange} /></span><InlineError message={error} /></WizardRowShell>;
}

export function RadioPair({ name, value, onChange }: { name: string; value: string; onChange: (value: 'Yes' | 'No') => void }) {
  return <>{(['Yes', 'No'] as const).map((option) => <label key={option} className="flex cursor-pointer items-center gap-[10px] text-[14px] text-[#2e3a43]"><input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} className="h-[20px] w-[20px] accent-[#003865]" />{option}</label>)}</>;
}

export function WizardCheckbox({ id, label, checked, onChange }: { id?: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const error = useFieldError(id);
  return <label className="group flex min-h-[48px] items-start gap-3 border-b border-[#edf1f3] px-[21px] py-[14px] text-[14px] leading-[18px] text-[#2e3a43] focus-within:bg-[#eef3f6]"><input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-px h-[18px] w-[18px] shrink-0 accent-[#003865]" /><span>{label}<InlineError message={error} /></span></label>;
}

export function WizardCard({ title, titleHelp, subtitle, children, className = '', onRemove, removeLabel = 'Remove', removeDisabled = false, split = true }: { title: string; titleHelp?: string; subtitle?: ReactNode; children: ReactNode; className?: string; onRemove?: () => void; removeLabel?: string; removeDisabled?: boolean; split?: boolean }) {
  const heading = <h2 className="flex items-center gap-[8px] whitespace-nowrap font-slab text-[17px] font-bold leading-[21px] text-[#2e3a43]">{title}{titleHelp && <HelpDot text={titleHelp} label={title} />}</h2>;
  return <section className={`overflow-hidden rounded-[3px] border border-[#cfdbe3] bg-white ${className}`}>
    {split
      ? <div className="flex min-h-[45px] border-b border-[#cfdbe3]"><div className="flex w-[225px] shrink-0 items-center border-r border-[#cfdbe3] bg-[#e4ecf1] pl-[21px] pr-[4px]">{heading}</div><div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-[5px] pl-[13px] pr-[20px]"><span className="text-[14px] font-bold leading-[18px] text-[#2e3a43]">{subtitle}</span>{onRemove && <RemoveButton label={removeLabel} onClick={onRemove} disabled={removeDisabled} />}</div></div>
      : <div className="flex min-h-[45px] items-center justify-between border-b border-[#cfdbe3] bg-[#e4ecf1] pl-[21px] pr-[20px]">{heading}{subtitle && <span className="text-[14px] font-bold text-[#2e3a43]">{subtitle}</span>}</div>}
    {children}
  </section>;
}

/** Big outlined "ADD …" button used in the household side cards. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mx-[20px] my-[24px] flex h-[66px] w-[calc(100%-40px)] items-center justify-center gap-[14px] rounded-[3px] border-2 border-[#0073cf] bg-white text-[16px] font-bold text-[#003865] outline-none hover:bg-[#e8f4fa] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]"><span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#003865] text-white"><Plus size={18} strokeWidth={3} /></span>{label}</button>;
}

/** "⊕ Add …" text link. */
export function AddLink({ label, onClick, className = '' }: { label: string; onClick: () => void; className?: string }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-[6px] text-[14px] font-bold text-[#2e3a43] underline underline-offset-2 outline-none hover:text-[#003865] focus-visible:shadow-[0_0_0_2px_#e87722] ${className}`}><CirclePlus size={17} className="fill-[#2e3a43] text-white" strokeWidth={2} />{label}</button>;
}

/** Read-only label/value row for review screens. */
export function WizardRow({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-[#edf1f3] px-[21px] py-2 text-[14px] text-[#2e3a43]"><span className="text-[#5c6670]">{label}</span><span className={`text-right ${strong ? 'text-[16px] font-bold text-[#003865]' : 'font-medium'}`}>{value || '—'}</span></div>;
}

/** Green check used in the stepper. */
export function DoneCheck() {
  return <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[#0f7a52] text-white"><Check size={11} strokeWidth={3.5} /></span>;
}
