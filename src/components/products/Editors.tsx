// State-agnostic editors for config-driven products (personal toys/renters and commercial lines).
// Callers pass the data and callbacks, so the same screens serve quoting and policy changes.
import { useState, type ReactNode } from 'react';
import { Search, type LucideIcon } from 'lucide-react';
import type { CoverageDef, FieldContext, FieldDef, InterestedParty, ProductConfig, ProductQuote, ProductUnit, UnitPremium } from '@/products/types';
import type { RatingFactor } from '@/types/quote';
import { resolveOptions } from '@/products/helpers';
import { formatCurrency } from '@/utils/masks';
import type { Mask } from '@/utils/masks';
import { AddButton, AddLink, HelpDot, InlineError, RemoveButton, SelectControl, WizardCard, WizardField, WizardRowShell, WizardSelect } from '@/components/wizard/primitives';
import { useFieldError } from '@/components/wizard/stepValidation';

const MASKS: Partial<Record<FieldDef['type'], Mask>> = { money: 'money', digits: 'number', zip: 'zip', vin: 'vin', hin: 'hin' };
const EXTRA_LABELS: Record<string, string> = { hull: 'Physical Damage (Hull):', trailer: 'Boat Trailer:', fullTimer: "Full-Timer's Coverage:", filing: 'State/Federal Filing Fee:', minimum: 'Minimum Premium Adjustment:', property: 'Property (Building & Contents):', equipmentBreakdown: 'Equipment Breakdown:' };

export type ContextFor = (values: Record<string, string>) => FieldContext;

/** One config field rendered as the carrier's two-column row. */
export function ConfigField({ field, id, value, ctx, onChange, after, narrow = false }: { field: FieldDef; id: string; value: string; ctx: FieldContext; onChange: (value: string) => void; after?: ReactNode; narrow?: boolean }) {
  if (field.showIf && !field.showIf(ctx)) return null;
  const common = { id, label: field.label, help: !!field.help, helpText: field.help, tag: field.tag, divider: field.divider, narrow, after };
  if (field.type === 'display') return <WizardField {...common} id={undefined} disabled value={field.compute?.(ctx) ?? ''} />;
  if (field.type === 'select') return <WizardSelect {...common} options={resolveOptions(field, ctx).map(({ value: optionValue, label }) => ({ value: optionValue, label }))} value={value} onChange={onChange} />;
  return <WizardField {...common} mask={MASKS[field.type]} money={field.type === 'money'} placeholder={field.placeholder} icon={field.type === 'vin' || field.type === 'hin' ? <Search size={17} strokeWidth={2} /> : undefined} value={value} onChange={onChange} />;
}

export function InterestedPartiesCard({ interests, onChange, title = 'Interested Parties', description }: { interests: InterestedParty[]; onChange: (interests: InterestedParty[]) => void; title?: string; description: string }) {
  const [draft, setDraft] = useState<Omit<InterestedParty, 'id'>>({ name: '', address: '' });
  const [error, setError] = useState('');
  const add = () => {
    if (!draft.name.trim() || !draft.address.trim()) { setError('Enter the name and mailing address.'); return; }
    onChange([...interests, { id: `ip-${Math.random().toString(36).slice(2, 9)}`, name: draft.name.trim(), address: draft.address.trim() }]);
    setDraft({ name: '', address: '' });
    setError('');
  };
  const input = 'h-[38px] w-full rounded-[4px] border border-[#7b8a95] px-[12px] text-[14px] outline-none focus:border-[#003865] focus:shadow-[inset_0_0_0_1px_#003865,0_0_0_2px_#fff,0_0_0_4px_#e87722]';
  return <WizardCard title={title} split={false} className="w-[450px]">
    <div className="space-y-[10px] px-[21px] py-[14px] text-[14px]">
      <p className="text-[13px] text-[#5c6670]">{description}</p>
      {interests.map((party) => <div key={party.id} className="flex items-start justify-between gap-2 rounded-[3px] border border-[#cfdbe3] px-3 py-2"><span><b>{party.name}</b><span className="block text-[13px] text-[#5c6670]">{party.address}</span></span><RemoveButton label={`Remove ${party.name}`} onClick={() => onChange(interests.filter((entry) => entry.id !== party.id))} /></div>)}
      <input aria-label={`${title} name`} placeholder="Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={input} />
      <input aria-label={`${title} address`} placeholder="Mailing address" value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} className={input} />
      {error && <InlineError message={error} />}
      <AddLink label={`Add ${title.replace(/s$/, '')}`} onClick={add} />
    </div>
  </WizardCard>;
}

/** Unit cards (one active at a time) with the "at household/business" list and ADD button. */
export function UnitsEditor({ config, quote, ctxFor, idPrefix, icon: Icon, onValues, onAdd, onRemove, side, listTitle }: { config: ProductConfig; quote: ProductQuote; ctxFor: ContextFor; idPrefix: string; icon: LucideIcon; onValues: (unitId: string, values: Record<string, string>) => void; onAdd: () => string; onRemove: (unitId: string) => void; side?: ReactNode; listTitle?: string }) {
  const [activeId, setActiveId] = useState(quote.units[0]?.id ?? '');
  const unit: ProductUnit = quote.units.find((entry) => entry.id === activeId) ?? quote.units[0];
  if (!unit) return null;
  const index = quote.units.indexOf(unit);
  const remove = () => { const fallback = quote.units[index === 0 ? 1 : index - 1]; onRemove(unit.id); if (fallback) setActiveId(fallback.id); };
  const ctx = ctxFor(unit.values);
  return <div className="flex items-start gap-[20px]">
    <WizardCard title={config.unitLabel} className="w-[450px] shrink-0" subtitle={<>{config.describe(unit)}<br />{index + 1} of {quote.units.length}</>} onRemove={config.multiUnit ? remove : undefined} removeDisabled={quote.units.length === 1} removeLabel={`Remove ${config.describe(unit)}`}>
      {config.unitFields.map((field) => <ConfigField key={field.key} field={field} id={`${idPrefix}.${unit.id}.${field.key}`} value={unit.values[field.key] ?? ''} ctx={ctx} onChange={(value) => onValues(unit.id, { [field.key]: value })} />)}
    </WizardCard>
    <div className="w-[450px] shrink-0 space-y-[20px]">
      {config.multiUnit && <WizardCard title={listTitle ?? `${config.unitPlural} at Household`} split={false} className="w-[280px]">
        {quote.units.length > 1 && <ul>{quote.units.map((entry, i) => <li key={entry.id}><button type="button" onClick={() => setActiveId(entry.id)} className={`flex w-full items-center gap-2 border-b border-[#edf1f3] px-[21px] py-[11px] text-left text-[14px] text-[#003865] hover:bg-[#e8f4fa] ${entry.id === unit.id ? 'bg-[#eef3f6] font-bold' : ''}`}><Icon size={18} strokeWidth={1.6} />{config.unitLabel} {i + 1} ({config.describe(entry)})</button></li>)}</ul>}
        {quote.units.length < config.maxUnits && <AddButton label={`ADD A NEW ${config.unitLabel.toUpperCase()}`} onClick={() => setActiveId(onAdd())} />}
      </WizardCard>}
      {side}
    </div>
  </div>;
}

function QuestionRow({ question, id, value, ctx, onChange }: { question: FieldDef; id: string; value: string; ctx: FieldContext; onChange: (value: string) => void }) {
  const error = useFieldError(id);
  if (question.showIf && !question.showIf(ctx)) return null;
  return <div className="flex items-center text-[14px] leading-[21px]">
    <label htmlFor={id} className="w-[184px] shrink-0">{question.label}</label>
    <span className="ml-[8px] flex w-[18px] shrink-0 justify-center">{question.help && <HelpDot text={question.help} label="Help" />}</span>
    <span className="ml-[6px] w-[314px]">{question.type === 'select'
      ? <SelectControl id={id} value={value} options={resolveOptions(question, ctx).map(({ value: optionValue, label }) => ({ value: optionValue, label }))} onChange={onChange} error={error} />
      : <input id={id} value={value} onChange={(event) => onChange(question.type === 'money' || question.type === 'digits' ? event.target.value.replace(/[^\d,]/g, '') : event.target.value)} className={`h-[38px] w-full rounded-[4px] border px-[15px] text-[14px] outline-none ${error ? 'border-[#c8102e]' : 'border-[#7b8a95]'} focus:border-[#003865] focus:shadow-[inset_0_0_0_1px_#003865,0_0_0_2px_#fff,0_0_0_4px_#e87722]`} />}
      <InlineError message={error} /></span>
  </div>;
}

/** Underwriting / eligibility questions card. */
export function QuestionsCard({ title, icon: Icon, questions, answers, ctx, idPrefix, onAnswer }: { title: string; icon: LucideIcon; questions: FieldDef[]; answers: Record<string, string>; ctx: FieldContext; idPrefix: string; onAnswer: (key: string, value: string) => void }) {
  return <section className="rounded-[3px] border border-[#cfdbe3] bg-white">
    <h2 className="flex min-h-[45px] items-center gap-[12px] rounded-t-[3px] border-b border-[#cfdbe3] bg-[#e4ecf1] px-[20px] font-slab text-[17px] font-bold text-[#2e3a43]"><Icon size={26} strokeWidth={1.3} />{title}</h2>
    <div className="space-y-[26px] px-[20px] py-[24px]">{questions.map((question) => <QuestionRow key={question.key} question={question} id={`${idPrefix}.${question.key}`} value={answers[question.key] ?? ''} ctx={ctx} onChange={(value) => onAnswer(question.key, value)} />)}</div>
  </section>;
}

function Price({ amount, rated }: { amount: number; rated: boolean }) {
  return <span className="w-[48px] shrink-0 text-right text-[12px] text-[#5c6670]">{!rated ? '$ --' : `$${Math.round(amount).toLocaleString('en-US')}`}</span>;
}

export interface EditorRating { units: UnitPremium[]; fullTermPremium: number; discounts: string[]; factors: RatingFactor[]; termMonths: number }

/** Coverage cards with per-coverage premiums, policy totals and the rating summary. */
export function CoveragesEditor({ config, quote, rating, rated, ctxFor, idPrefix, onUnitCoverage, onPolicyCoverage, billPlans, policyTitle, singleSubtitle }: { config: ProductConfig; quote: ProductQuote; rating: EditorRating; rated: boolean; ctxFor: ContextFor; idPrefix: string; onUnitCoverage: (unitId: string, key: string, value: string) => void; onPolicyCoverage: (key: string, value: string) => void; billPlans?: ReactNode; policyTitle?: string; singleSubtitle?: string }) {
  const policyCoverages: CoverageDef[] = config.coverages.filter((coverage) => coverage.scope === 'policy');
  const unitCoverages: CoverageDef[] = config.coverages.filter((coverage) => coverage.scope === 'unit');
  const policyAmount = (key: string) => rating.units.reduce((sum, unit) => sum + (unit.amounts[key] ?? 0), 0);
  const isExtra = (key: string, amount: number) => amount > 0 && !config.coverages.some((coverage) => coverage.key === key && coverage.scope === 'unit') && !policyCoverages.some((coverage) => coverage.key === key);
  const unitCards = unitCoverages.length > 0 || rating.units.some((unit) => Object.entries(unit.amounts).some(([key, amount]) => isExtra(key, amount)));
  const showPolicyTotal = !unitCards;
  return <div className="space-y-[20px]">
    {policyCoverages.length > 0 && <WizardCard title={policyTitle ?? 'Policy Coverages'} className="w-[495px]" subtitle={singleSubtitle ?? 'All units'}>
      {policyCoverages.map((coverage) => <ConfigField key={coverage.key} field={coverage} narrow id={`${idPrefix}.policy.${coverage.key}`} value={quote.coverages[coverage.key] ?? ''} ctx={ctxFor(quote.coverages)} onChange={(value) => onPolicyCoverage(coverage.key, value)} after={coverage.type === 'display' ? undefined : <Price amount={policyAmount(coverage.key)} rated={rated} />} />)}
      {showPolicyTotal && <div className="flex min-h-[48px] border-t border-[#d7e0e6] text-[14px]"><div className="flex w-[225px] shrink-0 items-center border-r border-[#d7e0e6] pl-[21px] font-bold">Policy Total:</div><div className="flex items-center pl-[10px] text-[16px] font-medium">{rated ? formatCurrency(rating.fullTermPremium) : '$ --.--'}</div></div>}
    </WizardCard>}
    {unitCards && quote.units.map((unit, index) => {
      const premium = rating.units.find((entry) => entry.unitId === unit.id);
      const extras = Object.entries(premium?.amounts ?? {}).filter(([key, amount]) => isExtra(key, amount));
      return <WizardCard key={unit.id} title={config.unitPlural} className="w-[495px]" subtitle={<>{config.describe(unit)}<br />{index + 1} of {quote.units.length}</>}>
        {unitCoverages.map((coverage) => <ConfigField key={coverage.key} field={coverage} narrow id={`${idPrefix}.${unit.id}.${coverage.key}`} value={unit.coverages[coverage.key] ?? ''} ctx={ctxFor(unit.coverages)} onChange={(value) => onUnitCoverage(unit.id, coverage.key, value)} after={<Price amount={premium?.amounts[coverage.key] ?? 0} rated={rated} />} />)}
        {extras.map(([key, amount]) => <WizardRowShell key={key} label={EXTRA_LABELS[key] ?? `${key}:`}><span className="flex h-[38px] items-center gap-[10px]"><span className="w-[180px] text-[14px] text-[#5c6670]">Included</span><Price amount={amount} rated={rated} /></span></WizardRowShell>)}
        <div className="flex min-h-[48px] border-t border-[#d7e0e6] text-[14px]"><div className="flex w-[225px] shrink-0 items-center border-r border-[#d7e0e6] pl-[21px] font-bold">{config.unitLabel} Total:</div><div className="flex items-center pl-[10px] text-[16px] font-medium">{rated ? formatCurrency(premium?.total ?? 0) : '$ --.--'}</div></div>
      </WizardCard>;
    })}
    <WizardCard title="Policy" className="w-[880px]" subtitle={<span className="text-[13px] font-medium">{rating.termMonths}-month policy term</span>}>
      <WizardRowShell label="Discounts:" tag>
        <div className="grid grid-cols-2 gap-[20px] py-[9px] text-[14px] leading-[21px]">
          <div><div className="font-bold">Applied Discounts</div>{rated && (rating.discounts.length ? rating.discounts.map((discount) => <div key={discount}>{discount}</div>) : <div className="text-[#5c6670]">None</div>)}</div>
          <div><div className="font-bold">Rating Factors</div>{rated && rating.factors.map((factor) => <div key={factor.label} className="text-[13px]">{factor.label}: {factor.value}</div>)}</div>
        </div>
      </WizardRowShell>
    </WizardCard>
    {rated && billPlans}
  </div>;
}
