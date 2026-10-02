// Commercial Lines quote wizard: Business Information → Products → Drivers → Underwriting →
// Coverages/Bill Plans → Final Sale. Reuses the personal-lines wizard chrome and product editors.
import { useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, ClipboardList, Lightbulb, RotateCw, Store, Truck, UserRound, type LucideIcon } from 'lucide-react';
import type { CommercialKey, ProductUnit } from '@/products/types';
import type { CommercialDriver, CommercialQuote } from '@/commercial/types';
import { useQuote } from '@/context/useQuote';
import { runWithSpinner } from '@/services/processing';
import { notify } from '@/services/activity';
import { NotificationBell } from '@/components/NotificationBell';
import { PacketButtons } from '@/servicing/PacketButtons';
import { BUSINESS_FIELDS, COMMERCIAL_CONFIGS, DRIVER_ACCIDENTS, DRIVER_EXPERIENCE, DRIVER_LICENSE_TYPES, DRIVER_VIOLATIONS, SHARED_QUESTIONS } from '@/commercial/configs';
import { COMMERCIAL_STEPS, addCommercialProducts, commercialContext, commercialTotals, createCommercialDriver, isCommercialRated, rateCommercial, recalculateCommercial } from '@/commercial/engine';
import { incompleteCommercialSteps, validateCommercialStep } from '@/commercial/validation';
import { createUnit } from '@/products/engine';
import { PAYMENT_METHODS, US_STATES, YES_NO } from '@/data/options';
import { formatCurrency } from '@/utils/masks';
import { WizardLayout, Logo, type WizardFlow } from '@/components/wizard/WizardLayout';
import { AddButton, InlineError, MoneyTag, WizardCard, WizardCheckbox, WizardField, WizardRow, WizardSelect } from '@/components/wizard/primitives';
import { useFieldError, useStepValidation } from '@/components/wizard/stepValidation';
import { ConfigField, CoveragesEditor, QuestionsCard, UnitsEditor } from '@/components/products/Editors';
import { BillPlansCard } from '@/steps/CoveragesStep';

const ICONS: Record<CommercialKey, LucideIcon> = { commercialAuto: Truck, bop: Store, mgmt: BriefcaseBusiness };
const focusable = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';
const HINTS = [
  'Commercial Lines starts with the business, not a person. Enter the legal name from the business registration, the entity type and the industry class. The class drives eligibility and rates for every product.',
  'Schedule every vehicle titled to the business (Commercial Auto), every premises location (BOP/GL) and the organization details (Management Liability). VINs can be added now or at Final Sale.',
  'List every employee who drives a business vehicle. Vehicles over 26,000 lbs GVW need at least one CDL driver, and drivers with 3 or more violations are not acceptable.',
  'Underwriting questions decide eligibility. A "Yes" to hazardous materials, prior cancellation or bankruptcy means the risk must be referred to underwriting.',
  'Choose limits that meet the customer’s contract requirements (often $1,000,000), then click RECALCULATE. Commercial policies are written for 12 months.',
  'Collect VINs, confirm the down payment and have an authorized officer or owner sign the application before binding. Each product is issued as its own policy.',
];

/** Fictitious practice business for trainer walkthroughs (no real company's details). */
function sampleBusiness(quote: CommercialQuote): CommercialQuote {
  let next: CommercialQuote = {
    ...quote,
    business: { ...quote.business, name: 'Sample Contracting LLC', dba: '', entity: 'Limited Liability Company (LLC)', fein: '000000000', industry: quote.business.industry || 'Artisan Contractor - Carpentry', operations: 'Residential remodeling and repair', yearsInBusiness: '3 to 5 years', street: '200 Practice Avenue', city: 'Raleigh', state: 'North Carolina', zip: '27604', contact: 'Sam Example', phone: '919-555-0199', email: 'office@example.com', revenue: '850000', employees: '6', payroll: '310000' },
    effectiveDate: quote.effectiveDate,
  };
  next = { ...next, productQuotes: Object.fromEntries(Object.entries(next.productQuotes).map(([key, product]) => [key, { ...product!, units: product!.units.map((unit) => ({ ...unit, values: { ...unit.values, garagingZip: unit.values.garagingZip || '27604' } })) }])) };
  return next;
}

function CommercialHeader({ quote }: { quote: CommercialQuote }) {
  const { state, showDashboard, updateCommercial, toggleHints } = useQuote();
  const b = quote.business;
  const item = (label: string, value: string) => <div className="mr-[30px] min-w-0"><div className="text-[11px] font-bold uppercase leading-[14px] tracking-[.2px]">{label}</div><div className="mt-[3px] min-h-[20px] truncate font-slab text-[15px] leading-[20px]">{value}</div></div>;
  const button = `h-[30px] rounded-[3px] border border-white/70 px-[10px] text-[11.5px] font-bold uppercase hover:bg-white/10 ${focusable}`;
  return <header className="flex h-[63px] shrink-0 items-center bg-[#003865] pl-[24px] pr-[26px] text-white print:hidden">
    <button type="button" onClick={showDashboard} title="Return to dashboard" className={`w-[195px] shrink-0 text-left ${focusable}`}><Logo /></button>
    {b.name ? <>{item('Business', b.dba ? `${b.name} DBA ${b.dba}` : b.name)}{item('Contact', b.contact ?? '')}{item('Phone', b.phone ?? '')}</> : item('Commercial Lines Quote', quote.products.map((key) => COMMERCIAL_CONFIGS[key].name).join(', '))}
    <div className="ml-auto flex shrink-0 items-center gap-[14px]">
      <NotificationBell />
      <span className="text-[12.5px] font-medium">Hello, {state.agent.name}</span>
      {state.trainerMode && !quote.boundPolicyIds.length && <button type="button" onClick={() => updateCommercial(sampleBusiness)} className={button} title="Fill the business page with a fictitious practice business">Load Sample Business</button>}
      {state.trainerMode && <button type="button" onClick={toggleHints} className={`${button} flex items-center gap-1 ${state.ui.hintMode ? 'bg-[#e87722] border-[#e87722]' : ''}`}><Lightbulb size={13} />Hints</button>}
    </div>
  </header>;
}

/** Product tabs (COMMERCIAL AUTO / Quote #, ...) with ADD PRODUCTS for commercial lines not yet on the quote. */
function ProductStrip({ quote }: { quote: CommercialQuote }) {
  const { updateCommercial } = useQuote();
  const missing = (Object.keys(COMMERCIAL_CONFIGS) as CommercialKey[]).filter((key) => !quote.products.includes(key));
  const button = `h-[40px] rounded-[3px] border-2 border-[#0073cf] bg-white px-[15px] text-[12.5px] font-bold text-[#003865] hover:bg-[#e8f4fa] ${focusable}`;
  return <div className="sticky top-0 z-10 flex h-[100px] items-start justify-between bg-[#f1f6f9] px-[20px] pt-[20px] print:hidden">
    <div role="tablist" aria-label="Products on this quote" className="flex gap-[8px]">{quote.products.map((key) => {
      const selected = key === quote.active;
      return <button key={key} type="button" role="tab" aria-selected={selected} onClick={() => updateCommercial((current) => ({ ...current, active: key }))} className={`relative flex h-[60px] min-w-[176px] flex-col items-center justify-center px-[14px] ${selected ? 'bg-[#003865] text-white' : 'border-2 border-[#003865] bg-white text-[#003865] hover:bg-[#e8f4fa]'} ${focusable}`}><span className="text-[15px] font-bold leading-[19px]">{COMMERCIAL_CONFIGS[key].tabLabel}</span><span className="text-[13px] leading-[17px]">Quote #: {quote.productQuotes[key]?.quoteNumber}</span>{selected && <span className="absolute -bottom-[9px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[9px] border-x-transparent border-t-[#003865]" />}</button>;
    })}</div>
    {!quote.boundPolicyIds.length && <div className="flex gap-[14px]">
      {missing.map((key) => <button key={key} type="button" onClick={() => updateCommercial((current) => addCommercialProducts(current, [key]))} className={button}>ADD {COMMERCIAL_CONFIGS[key].tabLabel}</button>)}
      {quote.products.length > 1 && <button type="button" onClick={() => { if (window.confirm(`Remove ${COMMERCIAL_CONFIGS[quote.active].name} from this quote?`)) updateCommercial((current) => { const products = current.products.filter((key) => key !== current.active); const productQuotes = { ...current.productQuotes }; delete productQuotes[current.active]; return { ...current, products, productQuotes, active: products[0], drivers: products.includes('commercialAuto') ? current.drivers : [] }; }); }} className={button}>REMOVE PRODUCT</button>}
    </div>}
  </div>;
}

function BusinessContent({ quote }: { quote: CommercialQuote }) {
  const { updateCommercial } = useQuote();
  const ctx = commercialContext(quote, quote.business);
  const set = (key: string, value: string) => updateCommercial((current) => {
    const business = { ...current.business, [key]: value };
    // Scheduled units still at the old business ZIP follow the new one.
    const productQuotes = key !== 'zip' ? current.productQuotes : Object.fromEntries(Object.entries(current.productQuotes).map(([product, entry]) => [product, { ...entry!, units: entry!.units.map((unit) => (!unit.values.garagingZip || unit.values.garagingZip === current.business.zip ? { ...unit, values: { ...unit.values, garagingZip: value } } : unit)) }]));
    return { ...current, business, productQuotes };
  });
  return <div className="max-w-[880px] space-y-[20px]">
    <WizardCard title="Business Information" subtitle="Tell us about the business">
      {BUSINESS_FIELDS.map((field) => <ConfigField key={field.key} field={field} id={`business.${field.key}`} value={quote.business[field.key] ?? ''} ctx={ctx} onChange={(value) => set(field.key, value)} />)}
    </WizardCard>
    <WizardCard title="Policy Information" subtitle="All commercial products share one effective date">
      <WizardField id="commercial.effectiveDate" label="Policy Effective Date:*" mask="date" placeholder="MM/DD/YYYY" value={quote.effectiveDate} onChange={(effectiveDate) => updateCommercial((current) => ({ ...current, effectiveDate }))} helpText="Commercial policies can start today or up to 60 days ahead. The term is 12 months." help />
      <WizardRow label="Products on this quote" value={quote.products.map((key) => COMMERCIAL_CONFIGS[key].name).join(', ')} />
    </WizardCard>
  </div>;
}

function unitSetter(update: (fn: (quote: CommercialQuote) => CommercialQuote) => void, key: CommercialKey) {
  const mapUnits = (fn: (units: ProductUnit[]) => ProductUnit[]) => update((current) => ({ ...current, productQuotes: { ...current.productQuotes, [key]: { ...current.productQuotes[key]!, units: fn(current.productQuotes[key]!.units) } } }));
  return mapUnits;
}

function ProductsContent({ quote }: { quote: CommercialQuote }) {
  const { updateCommercial } = useQuote();
  const key = quote.active;
  const product = quote.productQuotes[key];
  if (!product) return null;
  const config = COMMERCIAL_CONFIGS[key];
  const mapUnits = unitSetter(updateCommercial, key);
  return <div className="mt-[20px]"><UnitsEditor key={key} config={config} quote={product} ctxFor={(values) => commercialContext(quote, values)} idPrefix={`cunit.${key}`} icon={ICONS[key]}
    onValues={(unitId, values) => mapUnits((units) => units.map((unit) => (unit.id === unitId ? { ...unit, values: { ...unit.values, ...values } } : unit)))}
    onAdd={() => { const unit = createUnit(config, quote.business.zip ?? ''); mapUnits((units) => [...units, unit]); return unit.id; }}
    onRemove={(unitId) => mapUnits((units) => (units.length > 1 ? units.filter((unit) => unit.id !== unitId) : units))} /></div>;
}

function DriverCard({ driver, index, count, onChange, onRemove }: { driver: CommercialDriver; index: number; count: number; onChange: (patch: Partial<CommercialDriver>) => void; onRemove: () => void }) {
  const id = (field: string) => `cdriver.${driver.id}.${field}`;
  const name = [driver.firstName, driver.lastName].filter(Boolean).join(' ');
  return <WizardCard title={`Driver ${index + 1}`} subtitle={name || 'New driver'} onRemove={count > 1 ? onRemove : undefined} removeLabel="Remove Driver">
    <WizardField id={id('firstName')} label="First Name:*" value={driver.firstName} onChange={(firstName) => onChange({ firstName })} />
    <WizardField id={id('lastName')} label="Last Name:*" value={driver.lastName} onChange={(lastName) => onChange({ lastName })} />
    <WizardField id={id('dob')} label="Date of Birth:*" mask="date" placeholder="MM/DD/YYYY" value={driver.dob} onChange={(dob) => onChange({ dob })} />
    <WizardSelect id={id('licenseState')} label="License State:*" options={US_STATES} value={driver.licenseState} onChange={(licenseState) => onChange({ licenseState })} divider />
    <WizardField id={id('licenseNumber')} label="License Number:*" value={driver.licenseNumber} onChange={(licenseNumber) => onChange({ licenseNumber: licenseNumber.toUpperCase() })} />
    <WizardSelect id={id('licenseType')} label="License Type:*" options={DRIVER_LICENSE_TYPES} value={driver.licenseType} onChange={(licenseType) => onChange({ licenseType })} tag />
    <WizardSelect id={id('experience')} label="Commercial Driving Experience:*" options={DRIVER_EXPERIENCE} value={driver.experience} onChange={(experience) => onChange({ experience })} tag />
    <WizardSelect id={id('violations')} label="Moving Violations (3 years):*" options={DRIVER_VIOLATIONS} value={driver.violations} onChange={(violations) => onChange({ violations })} tag divider />
    <WizardSelect id={id('accidents')} label="At-Fault Accidents (3 years):*" options={DRIVER_ACCIDENTS} value={driver.accidents} onChange={(accidents) => onChange({ accidents })} tag />
  </WizardCard>;
}

function DriversContent({ quote }: { quote: CommercialQuote }) {
  const { updateCommercial } = useQuote();
  const noneError = useFieldError('cdriver.none');
  const cdlError = useFieldError('cdriver.cdl');
  if (!quote.products.includes('commercialAuto')) return <div className="max-w-[880px] rounded-[3px] border border-[#cfdbe3] bg-white px-[20px] py-[18px] text-[14px]"><div className="flex items-center gap-2 font-bold"><UserRound size={18} />No driver schedule required</div><p className="mt-1 text-[#5c6670]">A driver schedule is only needed when Commercial Auto is on the quote. Continue to Underwriting.</p></div>;
  const setDriver = (driverId: string, patch: Partial<CommercialDriver>) => updateCommercial((current) => ({ ...current, drivers: current.drivers.map((driver) => (driver.id === driverId ? { ...driver, ...patch } : driver)) }));
  return <div className="max-w-[880px] space-y-[20px]">
    {(noneError || cdlError) && <div id={noneError ? 'cdriver.none' : 'cdriver.cdl'} tabIndex={-1} className="rounded-[3px] border border-[#c8102e] bg-[#fdf0f1] px-[16px] py-[10px] text-[14px] outline-none"><InlineError message={noneError ?? cdlError} /></div>}
    {quote.drivers.map((driver, index) => <DriverCard key={driver.id} driver={driver} index={index} count={quote.drivers.length} onChange={(patch) => setDriver(driver.id, patch)} onRemove={() => updateCommercial((current) => ({ ...current, drivers: current.drivers.filter((entry) => entry.id !== driver.id) }))} />)}
    {quote.drivers.length < 10 && <AddButton label="Add Another Driver" onClick={() => updateCommercial((current) => ({ ...current, drivers: [...current.drivers, createCommercialDriver()] }))} />}
  </div>;
}

function UnderwritingContent({ quote }: { quote: CommercialQuote }) {
  const { updateCommercial } = useQuote();
  return <div className="max-w-[880px] space-y-[20px]">
    <QuestionsCard title="Business History" icon={ClipboardList} questions={SHARED_QUESTIONS} answers={quote.answers} ctx={commercialContext(quote, quote.answers)} idPrefix="cq.shared" onAnswer={(key, value) => updateCommercial((current) => ({ ...current, answers: { ...current.answers, [key]: value } }))} />
    {quote.products.map((key) => {
      const answers = quote.productQuotes[key]?.answers ?? {};
      return <QuestionsCard key={key} title={`${COMMERCIAL_CONFIGS[key].name} Underwriting`} icon={ICONS[key]} questions={COMMERCIAL_CONFIGS[key].questions} answers={answers} ctx={commercialContext(quote, answers)} idPrefix={`cq.${key}`} onAnswer={(question, value) => updateCommercial((current) => ({ ...current, productQuotes: { ...current.productQuotes, [key]: { ...current.productQuotes[key]!, answers: { ...current.productQuotes[key]!.answers, [question]: value } } } }))} />;
    })}
  </div>;
}

function CoveragesContent({ quote }: { quote: CommercialQuote }) {
  const { updateCommercial } = useQuote();
  const key = quote.active;
  const product = quote.productQuotes[key];
  const rateError = useFieldError('crate');
  if (!product) return null;
  const config = COMMERCIAL_CONFIGS[key];
  const rating = rateCommercial(key, quote);
  const rated = isCommercialRated(key, quote);
  const setProduct = (patch: Partial<typeof product>) => updateCommercial((current) => ({ ...current, productQuotes: { ...current.productQuotes, [key]: { ...current.productQuotes[key]!, ...patch } } }));
  const billPlans = rated ? <BillPlansCard fieldId={`cbill.${key}`} name={key} allPlans={rating.billPlans} selected={product.billPlan} onChoose={(billPlan) => setProduct({ billPlan })} termMonths={rating.termMonths} /> : undefined;
  const others = quote.products.filter((entry) => entry !== key);
  return <div className="space-y-[20px]">
    {others.length > 0 && <div className="flex w-[880px] flex-wrap gap-x-[20px] gap-y-1 rounded-[3px] border border-[#cfdbe3] bg-white px-[16px] py-[10px] text-[13px]"><span className="font-bold">Other products on this quote:</span>{others.map((entry) => <button key={entry} type="button" onClick={() => updateCommercial((current) => ({ ...current, active: entry }))} className="text-[#0073cf] underline underline-offset-2">{COMMERCIAL_CONFIGS[entry].name} {isCommercialRated(entry, quote) ? '(rated)' : '(needs RECALCULATE)'}</button>)}</div>}
    <CoveragesEditor key={key} config={config} quote={product} rating={rating} rated={rated} ctxFor={(values) => commercialContext(quote, values)} idPrefix={`ccov.${key}`}
      onUnitCoverage={(unitId, coverage, value) => setProduct({ units: product.units.map((unit) => (unit.id === unitId ? { ...unit, coverages: { ...unit.coverages, [coverage]: value } } : unit)) })}
      onPolicyCoverage={(coverage, value) => setProduct({ coverages: { ...product.coverages, [coverage]: value } })}
      billPlans={billPlans} policyTitle={key === 'mgmt' ? 'Coverage Parts' : undefined} />
    {rateError && <div id="crate" tabIndex={-1} className="flex w-[880px] items-center gap-2 rounded-[3px] border border-[#c2185b] bg-[#fdf0f5] px-[16px] py-[10px] text-[14px] font-medium text-[#8e1245] outline-none"><MoneyTag />{rateError}</div>}
  </div>;
}

function PremiumTotal({ quote }: { quote: CommercialQuote }) {
  const { updateCommercial } = useQuote();
  const { reveal } = useStepValidation();
  const totals = commercialTotals(quote);
  const rated = totals.every((entry) => entry.rated);
  const active = totals.find((entry) => entry.key === quote.active) ?? totals[0];
  const [flash, setFlash] = useState(false);
  const wasRated = useRef(rated);
  useEffect(() => {
    if (rated && !wasRated.current) {
      setFlash(true);
      const timer = window.setTimeout(() => setFlash(false), 4000);
      wasRated.current = rated;
      return () => window.clearTimeout(timer);
    }
    wasRated.current = rated;
  }, [rated]);
  const onRecalculate = () => {
    const blocking = Object.keys(validateCommercialStep(4, quote)).filter((key) => key !== 'crate');
    if (blocking.length) { reveal(); return; }
    updateCommercial(recalculateCommercial);
    notify({ kind: 'quote', title: 'Commercial quote rated', detail: `${quote.business.name || 'Business'}: ${quote.products.map((key) => COMMERCIAL_CONFIGS[key].name).join(', ')}.`, target: { view: 'commercial' } });
  };
  return <div className="flex items-center gap-[14px]">
    <div className={`flex h-[40px] items-center gap-[14px] rounded-[3px] px-[12px] ${flash ? 'shadow-[inset_0_0_0_2px_#c2185b]' : ''}`}><span className="text-[14px] text-[#5c6670]">Total {COMMERCIAL_CONFIGS[active.key].name} Premium:</span><span className="text-[18px] font-bold text-[#2e3a43]" aria-live="polite">{rated ? formatCurrency(active.plan.total) : '$ --.--'}</span></div>
    {!rated && <button type="button" onClick={onRecalculate} className={`flex h-[40px] items-center gap-[8px] rounded-[3px] bg-[#c2185b] px-[16px] text-[12.5px] font-bold uppercase text-white hover:bg-[#a0134b] ${focusable}`}><RotateCw size={16} strokeWidth={2.6} />Recalculate</button>}
  </div>;
}

function FinalSaleContent({ quote }: { quote: CommercialQuote }) {
  const { state, updateCommercial, bindCommercial, openPolicy, openPolicies } = useQuote();
  const { errors, reveal } = useStepValidation();
  const totals = commercialTotals(quote);
  const vehicles = quote.productQuotes.commercialAuto?.units ?? [];
  const bound = quote.boundPolicyIds.map((id) => state.policies.find((policy) => policy.id === id)).filter((policy) => !!policy);
  const set = (patch: Partial<CommercialQuote>) => updateCommercial((current) => ({ ...current, ...patch }));
  const setVin = (unitId: string, vin: string) => updateCommercial((current) => ({ ...current, productQuotes: { ...current.productQuotes, commercialAuto: { ...current.productQuotes.commercialAuto!, units: current.productQuotes.commercialAuto!.units.map((unit) => (unit.id === unitId ? { ...unit, values: { ...unit.values, vin } } : unit)) } } }));
  const incomplete = incompleteCommercialSteps(quote).filter((step) => step < 5);
  const bind = () => {
    if (incomplete.length) { window.alert(`Complete ${incomplete.map((step) => COMMERCIAL_STEPS[step]).join(', ')} before binding.`); return; }
    if (Object.keys(errors).length) { reveal(); return; }
    runWithSpinner('Binding commercial policies...', () => { bindCommercial(); }, 1400);
  };
  if (bound.length) return <div className="max-w-[880px] space-y-[20px]">
    <div role="status" className="flex items-start gap-3 rounded-[3px] border border-[#0f7a52] bg-[#eef8f3] px-[18px] py-[14px] text-[14px]"><CheckCircle2 size={22} className="shrink-0 text-[#0f7a52]" /><div><div className="font-slab text-[17px] font-bold">{bound.length} commercial polic{bound.length > 1 ? 'ies' : 'y'} issued</div><p className="mt-1 text-[#2e3a43]">Declarations, the application and a certificate of insurance are in each policy&rsquo;s Documents tab. Billing and servicing work the same as personal lines.</p></div></div>
    <WizardCard title="Issued Policies" split={false}>{bound.map((policy) => <div key={policy.id} className="flex items-center justify-between border-b border-[#edf1f3] px-[21px] py-[12px] text-[14px] last:border-b-0"><span><b>{policy.productName}</b> · Policy #{policy.policyNumber} · {formatCurrency(policy.termPremium)} ({policy.billPlanName})<span className="mt-1 block"><PacketButtons policy={policy} compact /></span></span><button type="button" onClick={() => openPolicy(policy.id)} className={`h-[34px] rounded-[3px] bg-[#0073cf] px-[14px] text-[12px] font-bold uppercase text-white hover:bg-[#003865] ${focusable}`}>View Policy</button></div>)}</WizardCard>
    <button type="button" onClick={() => openPolicies({ mode: 'Customer', lastName: quote.business.name })} className="text-[14px] font-bold text-[#0073cf] underline">Go to Manage Policies</button>
  </div>;
  return <div className="max-w-[880px] space-y-[20px]">
    <WizardCard title="Premium Summary" split={false}>{totals.map((entry) => <WizardRow key={entry.key} label={`${COMMERCIAL_CONFIGS[entry.key].name} (Quote #${entry.quoteNumber})`} value={entry.rated ? `${formatCurrency(entry.plan.total)} · ${entry.plan.name} · ${entry.termMonths} months` : 'Needs RECALCULATE on Coverages/Bill Plans'} />)}<WizardRow strong label="Total premium, all products" value={formatCurrency(totals.reduce((sum, entry) => sum + entry.plan.total, 0))} /></WizardCard>
    {vehicles.length > 0 && <WizardCard title="Vehicle VINs" subtitle="Required before binding Commercial Auto">{vehicles.map((unit, index) => <WizardField key={unit.id} id={`cfinal.vin.${unit.id}`} label={`Vehicle ${index + 1}: ${COMMERCIAL_CONFIGS.commercialAuto.describe(unit)}`} mask="vin" value={unit.values.vin ?? ''} onChange={(vin) => setVin(unit.id, vin)} />)}</WizardCard>}
    <WizardCard title="Payment" subtitle="Down payment for every product on this quote">
      <WizardSelect id="cfinal.paymentMethod" label="Down Payment Method:*" options={PAYMENT_METHODS} value={quote.paymentMethod} onChange={(paymentMethod) => set({ paymentMethod })} />
      <WizardSelect id="cfinal.paymentAuthorized" label="Payment authorized by the business?*" options={YES_NO} value={quote.paymentAuthorized} onChange={(paymentAuthorized) => set({ paymentAuthorized })} />
    </WizardCard>
    <WizardCard title="Signatures" split={false}>
      <WizardCheckbox id="cfinal.signed" label="The commercial application was signed by an authorized owner or officer of the business." checked={quote.signedApplication} onChange={(signedApplication) => set({ signedApplication })} />
      <WizardCheckbox id="cfinal.accuracy" label="I reviewed the business information, vehicle and location schedules, drivers and underwriting answers with the customer." checked={quote.confirmedAccuracy} onChange={(confirmedAccuracy) => set({ confirmedAccuracy })} />
    </WizardCard>
    <button type="button" onClick={bind} className={`h-[44px] rounded-[3px] bg-[#0f7a52] px-[22px] text-[13px] font-bold uppercase text-white hover:bg-[#0b5e3f] ${focusable}`}>Bind {quote.products.length} Commercial Polic{quote.products.length > 1 ? 'ies' : 'y'}</button>
  </div>;
}

const CONTENT = [BusinessContent, ProductsContent, DriversContent, UnderwritingContent, CoveragesContent, FinalSaleContent];

export function CommercialFlow() {
  const { state, updateCommercial } = useQuote();
  const quote = state.commercial!;
  const errors = useMemo(() => validateCommercialStep(quote.step, quote), [quote]);
  const incomplete = useMemo(() => incompleteCommercialSteps(quote), [quote]);
  const flow: WizardFlow = {
    steps: COMMERCIAL_STEPS, step: quote.step, maxStep: quote.maxStep, errors, incomplete, hint: HINTS[quote.step],
    go: (step) => updateCommercial((current) => ({ ...current, step, maxStep: Math.max(current.maxStep, step) })),
    header: <CommercialHeader quote={quote} />,
  };
  // An error on another product's tab switches the tab so the field can be focused.
  const onRevealField = (id: string) => {
    const match = /^c(?:unit|cov|q)\.(commercialAuto|bop|mgmt)\./.exec(id);
    if (match && match[1] !== quote.active) updateCommercial((current) => ({ ...current, active: match[1] as CommercialKey }));
  };
  const Content = CONTENT[quote.step];
  const tabs = quote.step === 1 || quote.step === 4;
  return <WizardLayout key={quote.step} flow={flow} strip={tabs ? <ProductStrip quote={quote} /> : undefined} contentClassName={tabs ? 'pt-0' : 'pt-[30px]'} onRevealField={onRevealField} actionCenter={quote.step === 4 ? <PremiumTotal quote={quote} /> : undefined}>
    <Content quote={quote} />
  </WizardLayout>;
}
