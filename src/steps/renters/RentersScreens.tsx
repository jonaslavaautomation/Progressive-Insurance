// Renters (HO4) screens laid out like the carrier's renters flow:
// Products (location address, eligibility, personal property, Bundle & Save), Additional Details
// (renters details, discounts, other questions) and Coverages (package, liability, deductibles,
// add-ons, itemized scheduled property).
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AlertTriangle, Building2, ChevronDown, ChevronUp, ExternalLink, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { PRODUCT_CONFIGS, SCHEDULED_CATEGORIES, parseScheduled, type ScheduledItem } from '@/products/configs';
import { isProductRated, rateProduct } from '@/products/engine';
import { rulesFor } from '@/data/states';
import { formatCurrency } from '@/utils/masks';
import { validateStep } from '@/utils/validation';
import { preferencesStore } from '@/services/quotePreferences';
import { HelpDot, InlineError, RadioPair, SelectControl, TextControl } from '@/components/wizard/primitives';
import { useFieldError } from '@/components/wizard/stepValidation';
import type { FieldDef } from '@/products/types';

const config = PRODUCT_CONFIGS.renters;
const fieldDef = (key: string) => config.unitFields.find((field) => field.key === key)!;
const question = (key: string) => config.questions.find((entry) => entry.key === key)!;
const coverage = (key: string) => config.coverages.find((entry) => entry.key === key)!;
const optionsOf = (def: FieldDef) => (Array.isArray(def.options) ? def.options.map(({ value, label }) => ({ value, label })) : []);

function Card({ title, icon, action, children, className = '' }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[3px] border border-[#cfdbe3] bg-white ${className}`}>
    <h2 className="flex min-h-[45px] items-center justify-between gap-3 border-b border-[#cfdbe3] bg-[#e4ecf1] px-[20px] font-slab text-[16px] font-bold text-[#2e3a43]"><span className="flex items-center gap-[10px]">{icon}{title}</span>{action}</h2>
    {children}
  </section>;
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => <div className="border-b border-[#edf1f3] px-[20px] py-[16px] last:border-b-0"><h3 className="mb-[12px] text-[13px] font-bold uppercase tracking-[.4px] text-[#2e3a43]">{title}</h3>{children}</div>;

function LabeledInput({ id, label, value, onChange, disabled, help, mask, money, width = 'w-full' }: { id?: string; label: string; value: string; onChange?: (value: string) => void; disabled?: boolean; help?: string; mask?: 'zip' | 'money'; money?: boolean; width?: string }) {
  const error = useFieldError(id);
  return <label className="flex items-center gap-3 text-[13px]"><span className="w-[110px] shrink-0 text-right">{label}</span><span className="flex min-w-0 flex-1 items-center gap-2"><TextControl id={id} value={value} onChange={onChange} disabled={disabled} error={error} mask={mask} money={money} className={width} />{help && <HelpDot text={help} label={label} />}</span></label>;
}

/** Household vehicles the carrier's data prefill finds for this customer (simulated, fictitious). */
const PREFILL_VEHICLES = [
  { year: '2019', make: 'Toyota', model: 'RAV4', body: 'Utility 4D' }, { year: '2016', make: 'Ford', model: 'F-150', body: 'SuperCrew Pickup' }, { year: '2021', make: 'Honda', model: 'Civic', body: 'Sedan 4D' },
  { year: '2018', make: 'Chevrolet', model: 'Equinox', body: 'Utility 4D' }, { year: '2020', make: 'Nissan', model: 'Rogue', body: 'Utility 4D' }, { year: '2017', make: 'Jeep', model: 'Grand Cherokee', body: 'Utility 4D' },
];
function householdVehicles(lastName: string, zip: string) {
  if (!lastName || !zip) return [];
  const seed = [...`${lastName.toLowerCase()}${zip}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return [PREFILL_VEHICLES[seed % PREFILL_VEHICLES.length], PREFILL_VEHICLES[(seed + 1) % PREFILL_VEHICLES.length]];
}

// ------------------------------------------------------------------ Products

export function RentersProductsContent() {
  const { state, updateUnitValues, addHouseholdVehicles } = useQuote();
  const product = state.productQuotes.renters;
  const unit = product?.units[0];
  const [bundleOpen, setBundleOpen] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const verifiedError = useFieldError(unit ? `unit.renters.${unit.id}.verifiedNone` : undefined);
  const dogError = useFieldError(unit ? `unit.renters.${unit.id}.dogBreed` : undefined);
  const eligibilityError = verifiedError ?? dogError;
  const endorseError = useFieldError(unit ? `unit.renters.${unit.id}.sameAsMailing` : undefined);
  if (!product || !unit) return null;
  const v = unit.values;
  const id = (key: string) => `unit.renters.${unit.id}.${key}`;
  const set = (values: Record<string, string>) => updateUnitValues('renters', unit.id, values);
  const mailing = state.insured.address;
  const rules = rulesFor(state.policy.quoteState);
  const atMailing = v.sameAsMailing !== 'No';
  const address = atMailing ? { line1: mailing.line1, line2: mailing.line2, city: mailing.city, zip: mailing.zip } : { line1: v.street ?? '', line2: v.street2 ?? '', city: v.city ?? '', zip: v.garagingZip ?? '' };
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address.line1, address.line2, address.city, rules.code, address.zip].filter(Boolean).join(' '))}`;
  const found = householdVehicles(state.insured.lastName, mailing.zip);
  const label = (vehicle: (typeof found)[number]) => `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const onQuote = state.products.includes('auto') ? state.vehicles.filter((vehicle) => vehicle.make).map((vehicle) => `${vehicle.year} ${vehicle.make} ${vehicle.model}`) : [];
  return <div className="mt-[20px] max-w-[1100px] space-y-[20px]">
    <Card title="Address, Eligibility, and Details">
      <Section title="Location Address">
        <div id={id('sameAsMailing')} tabIndex={-1} className="mb-[14px] flex flex-wrap items-center gap-x-[24px] gap-y-2 text-[13px] outline-none"><span>{fieldDef('sameAsMailing').label}</span><HelpDot text={fieldDef('sameAsMailing').help} label="Endorse location address" /><RadioPair name="renters-endorse" value={v.sameAsMailing ?? ''} onChange={(sameAsMailing) => set(sameAsMailing === 'Yes' ? { sameAsMailing, garagingZip: mailing.zip } : { sameAsMailing })} /></div>
        <InlineError message={endorseError} />
        <div className="grid grid-cols-2 gap-x-[30px] gap-y-[12px]">
          <LabeledInput id={atMailing ? undefined : id('street')} label="Address Line 1:*" value={address.line1} disabled={atMailing} onChange={(street) => set({ street })} />
          <LabeledInput id={atMailing ? undefined : id('city')} label="City:*" value={address.city} disabled={atMailing} onChange={(city) => set({ city })} />
          <LabeledInput id={atMailing ? undefined : id('street2')} label="Address Line 2:" value={address.line2} disabled={atMailing} onChange={(street2) => set({ street2 })} />
          <div className="flex gap-4"><LabeledInput label="State:*" value={rules.code} disabled width="w-[70px]" /><LabeledInput id={id('garagingZip')} label="Zip Code:*" mask="zip" value={atMailing ? mailing.zip : address.zip} disabled={atMailing} onChange={(garagingZip) => set({ garagingZip })} /></div>
          <label className="flex items-center gap-3 text-[13px]"><span className="w-[110px] shrink-0 text-right">Residence Type:*</span><span className="flex-1"><ResidenceSelect id={id('dwelling')} value={v.dwelling ?? ''} onChange={(dwelling) => set({ dwelling })} /></span></label>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 self-center text-[13px] text-[#0073cf] underline"><ExternalLink size={14} />View on Google Maps</a>
        </div>
        {atMailing && <p className="mt-[10px] text-[12px] text-[#5c6670]">The mailing address on Named Insured is used as the location address on the effective date. Choose &ldquo;No&rdquo; to enter a different rental address.</p>}
      </Section>
      <Section title="Eligibility">
        <p className="mb-2 text-[13px]">The following is ineligible:*</p>
        <div id={id('verifiedNone')} tabIndex={-1} className="space-y-2 outline-none">
          <label className="flex w-fit items-center gap-[10px] rounded-[2px] px-2 py-[6px] text-[13px]"><input type="checkbox" checked={v.dogBreed === 'Yes'} onChange={(event) => set(event.target.checked ? { dogBreed: 'Yes', verifiedNone: '' } : { dogBreed: 'No' })} className="h-[17px] w-[17px] accent-[#003865]" />{fieldDef('dogBreed').label}<HelpDot text="Breeds the carrier will not insure, or any dog with a bite history." label="Ineligible dog breed" /></label>
          <label className={`flex w-fit items-center gap-[10px] rounded-[2px] px-2 py-[6px] text-[13px] ${v.verifiedNone === 'Yes' ? 'bg-[#eef3f6]' : ''}`}><input type="checkbox" checked={v.verifiedNone === 'Yes'} onChange={(event) => set(event.target.checked ? { verifiedNone: 'Yes', dogBreed: 'No' } : { verifiedNone: '' })} className="h-[17px] w-[17px] accent-[#003865]" />{fieldDef('verifiedNone').label}</label>
        </div>
        <InlineError message={eligibilityError} />
      </Section>
      <Section title="Details">
        <div className="w-[520px]"><LabeledInput id={id('personalProperty')} label="Personal Property:*" money mask="money" value={v.personalProperty ?? ''} onChange={(personalProperty) => set({ personalProperty })} help={fieldDef('personalProperty').help} /></div>
      </Section>
    </Card>
    <Card title="BUNDLE & SAVE: Vehicles in the Household" action={<button type="button" onClick={() => setBundleOpen(!bundleOpen)} className="flex items-center gap-1 font-sans text-[11px] font-bold uppercase text-[#5c6670]">{bundleOpen ? 'Collapse' : 'Expand'}{bundleOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}>
      {bundleOpen && <div className="px-[20px] py-[16px] text-[13px]">
        {onQuote.length ? <p>Auto is on this quote with {onQuote.join(', ')}. The multi-policy discount applies to both products.</p>
          : found.length ? <>
            <div className="mb-3 flex items-center gap-[40px]"><span className="font-bold uppercase tracking-[.4px]">Vehicles found</span><label className="flex items-center gap-2"><input type="checkbox" checked={picked.length === found.length} onChange={(event) => setPicked(event.target.checked ? found.map(label) : [])} className="h-[16px] w-[16px] accent-[#003865]" />Select All Vehicles</label></div>
            <div className="grid grid-cols-2 gap-2">{found.map((vehicle) => <label key={label(vehicle)} className="flex items-center gap-2"><input type="checkbox" checked={picked.includes(label(vehicle))} onChange={(event) => setPicked(event.target.checked ? [...picked, label(vehicle)] : picked.filter((entry) => entry !== label(vehicle)))} className="h-[16px] w-[16px] accent-[#003865]" />{label(vehicle)}</label>)}</div>
            <div className="mt-4 text-center"><button type="button" disabled={!picked.length} onClick={() => { addHouseholdVehicles(found.filter((vehicle) => picked.includes(label(vehicle)))); setPicked([]); }} className="h-[34px] rounded-[3px] bg-[#0073cf] px-[22px] text-[12px] font-bold uppercase text-white hover:bg-[#003865] disabled:cursor-not-allowed disabled:bg-[#9fc2e3]">Update Quote</button></div>
            <p className="mt-2 text-center text-[11.5px] text-[#5c6670]">Vehicles found from household data for this address. Adding them puts Auto on the quote with the package discount.</p>
          </> : <p className="text-[#5c6670]">Complete the customer name and mailing address on Named Insured to look up household vehicles.</p>}
      </div>}
    </Card>
  </div>;
}

function ResidenceSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const error = useFieldError(id);
  return <SelectControl id={id} value={value} options={optionsOf(fieldDef('dwelling'))} onChange={onChange} error={error} />;
}

// ------------------------------------------------------------------ Additional Details

function QuestionSelect({ keyName, onChange, value }: { keyName: string; value: string; onChange: (value: string) => void }) {
  const def = question(keyName);
  const id = `answer.renters.${keyName}`;
  const error = useFieldError(id);
  return <div className="flex items-start gap-3 border-b border-[#edf1f3] px-[20px] py-[12px] text-[13.5px] last:border-b-0"><label htmlFor={id} className="w-[270px] shrink-0 pt-[9px]">{def.label}</label><span className="w-[20px] shrink-0 pt-[10px]">{def.help && <HelpDot text={def.help} label="Help" />}</span><span className="flex-1"><SelectControl id={id} value={value} options={optionsOf(def)} onChange={onChange} error={error} /><InlineError message={error} /></span></div>;
}

export function RentersDetailsCards() {
  const { state, updateProduct } = useQuote();
  const answers = state.productQuotes.renters?.answers ?? {};
  const set = (key: string) => (value: string) => updateProduct('renters', { answers: { ...answers, [key]: value } });
  const icon = <Building2 size={26} strokeWidth={1.3} />;
  const prior = answers.priorInsurer && answers.priorInsurer !== 'No prior renters insurance';
  return <>
    <Card title="Renters Details" icon={icon}>
      <QuestionSelect keyName="priorInsurer" value={answers.priorInsurer ?? ''} onChange={(priorInsurer) => updateProduct('renters', { answers: { ...answers, priorInsurer, ...(priorInsurer === 'No prior renters insurance' ? { priorLiability: '' } : {}) } })} />
      {prior && <QuestionSelect keyName="priorLiability" value={answers.priorLiability ?? ''} onChange={set('priorLiability')} />}
      <QuestionSelect keyName="claims" value={answers.claims ?? ''} onChange={set('claims')} />
      <QuestionSelect keyName="esign" value={answers.esign ?? ''} onChange={set('esign')} />
    </Card>
    <Card title="Renters Discounts" icon={icon}>
      <QuestionSelect keyName="packagePolicy" value={answers.packagePolicy ?? ''} onChange={set('packagePolicy')} />
      <QuestionSelect keyName="securedSubdivision" value={answers.securedSubdivision ?? ''} onChange={set('securedSubdivision')} />
    </Card>
  </>;
}

export function RentersOtherQuestions() {
  const { state, updateProduct } = useQuote();
  const answers = state.productQuotes.renters?.answers ?? {};
  return <Card title="Other Questions"><QuestionSelect keyName="paperless" value={answers.paperless ?? ''} onChange={(paperless) => updateProduct('renters', { answers: { ...answers, paperless } })} /></Card>;
}

// ------------------------------------------------------------------ Coverages

function CoverageSelect({ keyName, value, onChange, amount, rated }: { keyName: string; value: string; onChange: (value: string) => void; amount: number; rated: boolean }) {
  const def = coverage(keyName);
  const id = `coverage.renters.policy.${keyName}`;
  const error = useFieldError(id);
  return <div className="flex items-start gap-3 px-[20px] py-[10px] text-[13.5px]"><label htmlFor={id} className="w-[200px] shrink-0 pt-[9px]">{def.label}</label><span className="w-[20px] shrink-0 pt-[10px]">{def.help && <HelpDot text={def.help} label="Help" />}</span><span className="w-[220px]"><SelectControl id={id} value={value} options={optionsOf(def)} onChange={onChange} error={error} /><InlineError message={error} /></span><span className="ml-auto pt-[10px] text-[12px] tabular-nums text-[#5c6670]">{rated && amount ? formatCurrency(amount) : ''}</span></div>;
}

export function RentersCoveragesContent({ billPlans }: { billPlans: ReactNode }) {
  const { state, updateProduct, rateQuietly, openPage } = useQuote();
  const prefs = useSyncExternalStore(preferencesStore.subscribe, preferencesStore.get);
  const product = state.productQuotes.renters;
  const rated = isProductRated('renters', state);
  const blocking = Object.keys(validateStep(4, state)).filter((key) => key !== 'rate' && !key.startsWith('pos.') && !key.startsWith('billPlan'));
  const rentersOnly = state.products.every((key) => key === 'renters');
  // Renters rates as you go: re-rate whenever the inputs change and nothing is missing.
  useEffect(() => { if (rentersOnly && !rated && !blocking.length) rateQuietly(); }, [rentersOnly, rated, blocking.length, rateQuietly]);
  const [draft, setDraft] = useState<ScheduledItem>({ id: '', category: 'Jewelry', description: '', value: 0 });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [error, setError] = useState('');
  if (!product) return null;
  const unit = product.units[0];
  const c = product.coverages;
  const amounts = rateProduct('renters', state).units[0]?.amounts ?? {};
  const set = (key: string) => (value: string) => updateProduct('renters', { coverages: { ...c, [key]: value } });
  const items = parseScheduled(c.scheduled);
  const mailing = state.insured.address;
  const rules = rulesFor(state.policy.quoteState);
  const atMailing = unit.values.sameAsMailing !== 'No';
  const address = (atMailing ? [mailing.line1, mailing.line2, mailing.city] : [unit.values.street, unit.values.street2, unit.values.city]).filter(Boolean).join(' ');
  const addItem = () => {
    if (!draft.description.trim()) { setError('Describe the item (for example "Diamond engagement ring").'); return; }
    if (!(draft.value > 0)) { setError('Enter the appraised value.'); return; }
    if (draft.value > 25000) { setError('Items over $25,000 must be referred to underwriting.'); return; }
    setError('');
    updateProduct('renters', { coverages: { ...c, scheduled: JSON.stringify([...items, { ...draft, id: `sch-${Math.random().toString(36).slice(2, 8)}` }]) } });
    setDraft({ id: '', category: draft.category, description: '', value: 0 });
  };
  return <div className="mt-[20px] max-w-[1100px] space-y-[20px]">
    {!prefs.defaults && <div role="status" className="flex w-fit items-start gap-2 rounded-[3px] border border-[#cfdbe3] bg-white px-[14px] py-[10px] text-[13px]"><AlertTriangle size={17} className="mt-px shrink-0 fill-[#e87722] text-white" /><span><b>Please update your agent default coverage selections.</b><br /><button type="button" onClick={() => openPage('newQuote')} className="text-[#0073cf] underline">FAO homepage &gt; New Business menu &gt; Quote Preferences &gt; Default Coverages</button></span></div>}
    <Card title="Property Details">
      <div className="px-[20px] py-[14px] text-[13.5px]">
        <p className="font-bold">Address: {[address, `${rules.code} ${atMailing ? mailing.zip : unit.values.garagingZip ?? ''}`].filter(Boolean).join(', ').toUpperCase()}</p>
        <div className="mt-3 flex items-center gap-3"><span className="w-[200px]">Personal Property:*</span><TextControl value={unit.values.personalProperty ? formatCurrency(Number(String(unit.values.personalProperty).replace(/\D/g, ''))).replace('.00', '') : ''} disabled className="w-[220px]" /><span className="ml-auto text-[12px] tabular-nums text-[#5c6670]">{rated ? formatCurrency(amounts.personalProperty ?? 0) : ''}</span></div>
      </div>
      <div className="border-t border-[#edf1f3] px-[20px] py-[16px]">
        <button type="button" id="coverage.renters.policy.homeShield" aria-pressed={c.homeShield === 'Yes'} onClick={() => set('homeShield')(c.homeShield === 'Yes' ? 'No' : 'Yes')} className={`mx-auto flex items-center gap-3 rounded-[3px] border-2 px-[16px] py-[10px] text-left text-[14px] ${c.homeShield === 'Yes' ? 'border-[#0073cf] bg-[#e8f4fa]' : 'border-[#9aa6ae] bg-white hover:border-[#0073cf]'}`}>
          <input type="checkbox" readOnly checked={c.homeShield === 'Yes'} tabIndex={-1} className="h-[17px] w-[17px] accent-[#003865]" />
          <span><b className="block">HomeShield R Package</b><span className="text-[12.5px]">{formatCurrency(amounts.homeShield || 45)}</span></span><ShieldCheck size={26} className="text-[#003865]" />
        </button>
        <p className="mt-2 flex items-center justify-center gap-2 text-[12px] text-[#5c6670]">{coverage('homeShield').help}<HelpDot text={coverage('homeShield').help} label="HomeShield R Package" /></p>
      </div>
    </Card>
    <div className="grid grid-cols-2 gap-[20px]">
      <Card title="Liability Coverages"><CoverageSelect keyName="liability" value={c.liability ?? ''} onChange={set('liability')} amount={amounts.liability ?? 0} rated={rated} /><CoverageSelect keyName="medpay" value={c.medpay ?? ''} onChange={set('medpay')} amount={amounts.medpay ?? 0} rated={rated} /></Card>
      <Card title="Deductibles"><CoverageSelect keyName="deductible" value={c.deductible ?? ''} onChange={set('deductible')} amount={0} rated={rated} /></Card>
    </div>
    <Card title="Add-on Coverages"><div className="grid grid-cols-2"><CoverageSelect keyName="jewelry" value={c.jewelry ?? ''} onChange={set('jewelry')} amount={amounts.jewelry ?? 0} rated={rated} /><CoverageSelect keyName="computer" value={c.computer ?? ''} onChange={set('computer')} amount={amounts.computer ?? 0} rated={rated} /></div></Card>
    <Card title="Itemized Scheduled Personal Property" action={<button type="button" onClick={() => setScheduleOpen(!scheduleOpen)} className="flex items-center gap-1 font-sans text-[11px] font-bold uppercase text-[#5c6670]">{scheduleOpen ? 'Collapse' : `Expand${items.length ? ` (${items.length})` : ''}`}{scheduleOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}>
      {scheduleOpen && <div className="px-[20px] py-[14px] text-[13px]">
        <p className="mb-3 text-[#5c6670]">Schedule high-value items (each up to $25,000) for full coverage with no deductible. An appraisal or receipt dated within 3 years is required.</p>
        {items.length > 0 && <table className="mb-3 w-full border-collapse"><thead><tr className="bg-[#f3f2ed] text-left"><th className="border-b border-[#cfdbe3] px-2 py-1">Category</th><th className="border-b border-[#cfdbe3] px-2 py-1">Description</th><th className="border-b border-[#cfdbe3] px-2 py-1 text-right">Value</th><th className="border-b border-[#cfdbe3]" /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="border-b border-[#edf1f3] px-2 py-1">{item.category}</td><td className="border-b border-[#edf1f3] px-2 py-1">{item.description}</td><td className="border-b border-[#edf1f3] px-2 py-1 text-right">{formatCurrency(item.value)}</td><td className="border-b border-[#edf1f3] px-2 py-1 text-right"><button type="button" onClick={() => updateProduct('renters', { coverages: { ...c, scheduled: JSON.stringify(items.filter((entry) => entry.id !== item.id)) } })} aria-label={`Remove ${item.description}`} className="text-[#c8102e]"><Trash2 size={14} /></button></td></tr>)}</tbody></table>}
        <div className="flex items-end gap-2"><label className="block">Category<SelectControl value={draft.category} options={SCHEDULED_CATEGORIES} onChange={(category) => setDraft({ ...draft, category })} className="w-[170px]" /></label><label className="block flex-1">Description<TextControl value={draft.description} onChange={(description) => setDraft({ ...draft, description })} /></label><label className="block">Appraised value<TextControl value={draft.value ? String(draft.value) : ''} money mask="money" onChange={(value) => setDraft({ ...draft, value: Number(value.replace(/\D/g, '')) })} className="w-[140px]" /></label><button type="button" onClick={addItem} className="flex h-[38px] items-center gap-1 rounded-[3px] bg-[#0073cf] px-[12px] text-[12px] font-bold uppercase text-white hover:bg-[#003865]"><Plus size={14} />Add Item</button></div>
        <InlineError message={error} />
        {rated && items.length > 0 && <p className="mt-2 text-right text-[12px] text-[#5c6670]">Scheduled property premium: {formatCurrency(amounts.scheduled ?? 0)}</p>}
      </div>}
    </Card>
    {billPlans}
  </div>;
}
