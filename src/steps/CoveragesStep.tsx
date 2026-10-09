import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, RotateCw, Smartphone, X } from 'lucide-react';
import type { BillPlan, BillPlanQuote, CoverageKey, Vehicle } from '@/types/quote';
import type { OtherProductKey } from '@/products/types';
import { currentProduct } from '@/products/active';
import { productLabel } from '@/products/configs';
import { isProductRated, productTotals, rateProduct } from '@/products/engine';
import { ProductCoveragesContent } from '@/components/products/ProductForms';
import { RentersCoveragesContent } from '@/steps/renters/RentersScreens';
import { activeProducts } from '@/utils/ratingEngine';
import { BI_PD, COLL_DEDUCTIBLES, ETE, MED_PAY, OTC_DEDUCTIBLES, PIP_OPTIONS, SNAPSHOT_OPTIONS, TOWING, UMPD, UM_BI, coverageOptions } from '@/data/options';
import { rulesFor, stateOptions } from '@/data/states';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { formatCurrency } from '@/utils/masks';
import { vehicleName } from '@/utils/ratingEngine';
import { planPaymentText } from '@/utils/paymentSchedule';
import { validateStep } from '@/utils/validation';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { HelpDot, InlineError, MoneyTag, WizardCard, WizardCheckbox, WizardField, WizardRowShell, WizardSelect } from '@/components/wizard/primitives';
import { useFieldError, useStepValidation } from '@/components/wizard/stepValidation';
import { Modal } from '@/components/wizard/Modal';
import { RatingWorksheet } from '@/components/quote/RatingWorksheet';
import { modalButton } from '@/components/wizard/modalStyles';

const INITIAL_PLANS = 4;

function Price({ amount, rated }: { amount: number; rated: boolean }) {
  const text = !rated ? '$ --' : amount > 0 && amount < 10 ? `$${amount.toFixed(2)}` : `$${Math.round(amount).toLocaleString('en-US')}`;
  return <span className="w-[42px] shrink-0 text-right text-[12px] text-[#5c6670]">{text}</span>;
}

export function SnapshotPromo() {
  return <div className="mx-[14px] mt-[24px] rounded-[4px] border-2 border-[#003865] px-[12px] pb-[18px] pt-[16px] text-center text-[#2e3a43]">
    <div className="text-[12px] font-bold leading-[16px] text-[#003865]">SAFE DRIVING CAN MEAN BIG SAVINGS!</div>
    <div className="mt-[14px] flex flex-col items-center text-[#0073cf]"><Smartphone size={22} strokeWidth={1.6} /><span className="text-[19px] font-bold leading-[22px] tracking-[-.3px]">DriveSense</span></div>
    <p className="mt-[12px] text-[12px] leading-[17px]">Save 10% for signing up today and, at every renewal, up to 45% for the remainder of the policy. Encourage your customer to enroll in DriveSense today!</p>
  </div>;
}

/** Total Auto Premium + RECALCULATE, shown in the sticky action bar. */
function PremiumTotal() {
  const { state, rated: autoRated, recalculate } = useQuote();
  const product = currentProduct(state);
  const totals = productTotals(state, autoRated);
  const rated = totals.every((entry) => entry.rated);
  const plan = (totals.find((entry) => entry.key === product) ?? totals[0]).plan;
  const { reveal } = useStepValidation();
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
    // Required coverage selections must be complete before the quote can be rated.
    const blocking = Object.keys(validateStep(4, state)).filter((key) => key !== 'rate' && key !== 'pos.billPlan');
    if (blocking.length) { reveal(); return; }
    recalculate();
  };
  return <div className="flex items-center gap-[14px]">
    <div className={`flex h-[40px] items-center gap-[14px] rounded-[3px] px-[12px] ${flash ? 'shadow-[inset_0_0_0_2px_#c2185b]' : ''}`}><span className="text-[14px] text-[#5c6670]">Total {productLabel(product)} Premium:</span><span className="text-[18px] font-bold text-[#2e3a43]" aria-live="polite">{rated ? formatCurrency(plan.total) : '$ --.--'}</span></div>
    {!rated && <button type="button" onClick={onRecalculate} className="flex h-[40px] items-center gap-[8px] rounded-[3px] bg-[#c2185b] px-[16px] text-[12.5px] font-bold uppercase text-white outline-none hover:bg-[#a0134b] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]"><RotateCw size={16} strokeWidth={2.6} />Recalculate</button>}
  </div>;
}

function VehicleCoverageCard({ vehicle, index, count }: { vehicle: Vehicle; index: number; count: number }) {
  const { state, rating, rated, updateCoverages, updateVehicle } = useQuote();
  const { coverages } = state;
  const rules = rulesFor(state.policy.quoteState);
  const premium = rating.vehicles.find((entry) => entry.vehicleId === vehicle.id);
  const price = (key: CoverageKey) => <Price amount={premium?.coverages[key] ?? 0} rated={rated} />;
  // Policy-level controls repeat on each vehicle card; only the first carries the field id.
  const policyId = (field: string) => (index === 0 ? `coverages.${field}` : undefined);
  const id = (field: keyof Vehicle) => `vehicle.${vehicle.id}.${field}`;
  const set = (patch: Partial<Vehicle>) => updateVehicle(vehicle.id, patch);
  return <WizardCard title="Vehicles" className="w-[485px] shrink-0" subtitle={<>{vehicleName(vehicle)}<br />{index + 1} of {count}</>}>
    <WizardSelect id={policyId('bodilyInjuryPd')} narrow label="Bodily Injury & Property Damage:*" help hint={`${rules.name} minimum: ${rules.minimumText}`} options={coverageOptions(stateOptions(BI_PD, rules.liability))} value={coverages.bodilyInjuryPd} onChange={(bodilyInjuryPd) => updateCoverages({ bodilyInjuryPd })} after={price('bipd')} />
    <WizardSelect id={policyId('medicalPayments')} narrow label="Medical Payment:*" help options={coverageOptions(stateOptions(MED_PAY, rules.medPay))} value={coverages.medicalPayments} onChange={(medicalPayments) => updateCoverages({ medicalPayments })} after={price('medpay')} />
    <WizardSelect id={id('compDeductible')} narrow label="Other Than Collision Deductible:*" help hint={fieldHints.deductibles} options={coverageOptions(OTC_DEDUCTIBLES)} value={vehicle.compDeductible} onChange={(compDeductible) => set({ compDeductible })} after={price('otc')} />
    <WizardSelect id={id('collDeductible')} narrow label="Collision Deductible:*" help options={coverageOptions(COLL_DEDUCTIBLES)} value={vehicle.collDeductible} onChange={(collDeductible) => set({ collDeductible })} after={price('coll')} />
    <WizardSelect id={id('rental')} narrow label="Extended Transportation Expense:*" help options={coverageOptions(ETE)} value={vehicle.rental} onChange={(rental) => set({ rental })} after={price('ete')} />
    <WizardSelect id={id('roadside')} narrow label="Towing and Labor (Roadside):*" help options={coverageOptions(TOWING)} value={vehicle.roadside} onChange={(roadside) => set({ roadside })} after={price('towing')} />
    <WizardField id={id('customEquipment')} narrow label="Customizing Equipment Coverage:*" help hint={fieldHints.customEquipment} money mask="money" value={vehicle.customEquipment} onChange={(customEquipment) => set({ customEquipment })} after={price('cec')} />
    <WizardSelect id={policyId('snapshot')} narrow divider label="DriveSense Enrollment: *" tag hint={fieldHints.snapshot} options={SNAPSHOT_OPTIONS} value={coverages.snapshot} onChange={(snapshot) => updateCoverages({ snapshot })} />
    {rated && coverages.snapshot === 'Do Not Participate' && <div className="flex text-[12px] leading-[17px]"><div className="w-[225px] shrink-0 border-r border-[#d7e0e6]" /><p className="flex gap-[6px] py-[4px] pb-[10px] pl-[10px] pr-[14px]"><AlertTriangle size={15} className="mt-px shrink-0 text-[#e87722]" /><span><b>Less frequent driving or other good driving habits may help your customers save with DriveSense.</b> Signing up today can earn your customer a discount of 10%. Then at each renewal, they could earn up to 45% for the remainder of the policy thanks to safe driving habits.</span></p></div>}
    <div className="flex min-h-[48px] border-t border-[#d7e0e6] text-[14px]"><div className="flex w-[225px] shrink-0 items-center border-r border-[#d7e0e6] pl-[21px] font-bold">Vehicle Total:</div><div className="flex items-center pl-[10px] text-[16px] font-medium">{rated ? formatCurrency(premium?.total ?? 0) : '$ --.--'}</div></div>
  </WizardCard>;
}

function RatingDetails({ onClose }: { onClose: () => void }) {
  const { rating, plan } = useQuote();
  const [tab, setTab] = useState<'summary' | 'worksheet'>('summary');
  const rows: [string, CoverageKey][] = [['Bodily Injury & Property Damage', 'bipd'], ['Medical Payment', 'medpay'], ['Other Than Collision', 'otc'], ['Collision', 'coll'], ['Extended Transportation Expense', 'ete'], ['Towing and Labor', 'towing'], ['Customizing Equipment', 'cec']];
  const cell = 'border border-[#cfdbe3] px-3 py-[6px]';
  return <Modal title="Rating Details" width={900} onClose={onClose} footer={<button type="button" className={modalButton.blue} onClick={onClose}>Close</button>}>
    <div role="tablist" className="mb-[14px] flex gap-[4px] border-b border-[#cfdbe3]">{([['summary', 'Summary'], ['worksheet', 'Rating Worksheet']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`-mb-px rounded-t-[3px] border px-[14px] py-[7px] text-[13px] font-bold ${tab === key ? 'border-[#cfdbe3] border-b-white bg-white text-[#003865]' : 'border-transparent text-[#0073cf] hover:underline'}`}>{label}</button>)}</div>
    {tab === 'worksheet' ? <RatingWorksheet rating={rating} /> : <>
    <p className="mb-3 text-[13px] text-[#5c6670]">6-month premium by coverage. {rating.reportsApplied ? 'Includes Point of Sale report results.' : 'Preliminary rate: Point of Sale reports have not been ordered yet.'}</p>
    <table className="w-full border-collapse text-[13px]"><thead><tr className="bg-[#e4ecf1] text-left"><th className={cell}>Coverage</th>{rating.vehicles.map((vehicle) => <th key={vehicle.vehicleId} className={`${cell} text-right`}>{vehicle.label}</th>)}</tr></thead><tbody>
      {rows.map(([label, key]) => <tr key={key}><td className={cell}>{label}</td>{rating.vehicles.map((vehicle) => <td key={vehicle.vehicleId} className={`${cell} text-right tabular-nums`}>{formatCurrency(vehicle.coverages[key])}</td>)}</tr>)}
      <tr className="font-bold"><td className={cell}>Vehicle Total</td>{rating.vehicles.map((vehicle) => <td key={vehicle.vehicleId} className={`${cell} text-right tabular-nums`}>{formatCurrency(vehicle.total)}</td>)}</tr>
    </tbody></table>
    <div className="mt-3 grid grid-cols-3 gap-3 text-[13px]"><div>UM/UIM Bodily Injury: <b>{formatCurrency(rating.umbi)}</b></div><div>UM Property Damage: <b>{formatCurrency(rating.umpd)}</b></div><div>Personal Injury Protection: <b>{formatCurrency(rating.pip)}</b></div><div>Full-term premium: <b>{formatCurrency(rating.fullTermPremium)}</b></div></div>
    <h3 className="mb-1 mt-4 font-bold">Rating factors</h3>
    <table className="w-full border-collapse text-[13px]"><tbody>{rating.factors.map((factor) => <tr key={factor.label}><td className={cell}>{factor.label}</td><td className={`${cell} w-[260px] text-right`}>{factor.value}</td></tr>)}</tbody></table>
    <p className="mt-3 text-[13px]">Selected bill plan: <b>{plan.name}</b>, total <b>{formatCurrency(plan.total)}</b>.</p>
    </>}
  </Modal>;
}

function PolicyCard({ onViewDetails }: { onViewDetails: () => void }) {
  const { state, rating, rated, updateCoverages, goToStep } = useQuote();
  const { coverages } = state;
  const rules = rulesFor(state.policy.quoteState);
  const rejected = coverages.pip === 'Rejected' || coverages.uninsuredMotorist === 'Rejected';
  const focusSnapshot = () => document.getElementById('coverages.snapshot')?.focus();
  return <WizardCard title="Policy" className="w-[880px]" subtitle={<button type="button" onClick={onViewDetails} className="text-[13px] font-bold text-[#0073cf] underline underline-offset-2 hover:text-[#003865]">View Rating Details</button>}>
    <WizardSelect id="coverages.uninsuredMotorist" narrow label="Uninsured/Underinsured Motorist Bodily Injury:*" help hint={fieldHints.uninsuredMotorist} options={coverageOptions(stateOptions(UM_BI, rules.um.choices))} value={coverages.uninsuredMotorist} onChange={(uninsuredMotorist) => updateCoverages({ uninsuredMotorist })} after={<Price amount={rating.umbi} rated={rated} />} />
    {rules.umpd && <WizardSelect id="coverages.umpd" narrow label="Uninsured Motorist Property Damage:*" help hint={fieldHints.umpd} options={coverageOptions(UMPD)} value={coverages.umpd} onChange={(umpd) => updateCoverages({ umpd })} after={<Price amount={rating.umpd} rated={rated} />} />}
    {rules.pip && <WizardSelect id="coverages.pip" narrow label="Personal Injury Protection:*" help helpText={rules.pip.text} options={coverageOptions(stateOptions(PIP_OPTIONS, rules.pip.choices))} value={coverages.pip} onChange={(pip) => updateCoverages({ pip })} after={<Price amount={rating.pip} rated={rated} />} />}
    {rejected && <WizardCheckbox id="coverages.rejectionSigned" label={`The customer signed the ${rules.name} rejection form for ${[coverages.pip === 'Rejected' ? 'Personal Injury Protection' : '', coverages.uninsuredMotorist === 'Rejected' ? 'Uninsured/Underinsured Motorist' : ''].filter(Boolean).join(' and ')} coverage.`} checked={coverages.rejectionSigned} onChange={(rejectionSigned) => updateCoverages({ rejectionSigned })} />}
    <div className="border-b border-[#edf1f3] bg-[#f6f9fb] px-[21px] py-[10px] text-[12.5px] leading-[18px] text-[#3d4b55]"><b>{rules.name} requirements:</b> {rules.minimumText} {rules.um.text}{rules.pip ? ` ${rules.pip.text}` : ''}</div>
    <WizardRowShell label="Discounts:" tag>
      <div className="grid grid-cols-2 gap-[20px] py-[9px] text-[14px] leading-[21px]">
        <div><div className="font-bold">Applied Discounts</div>{rated && rating.appliedDiscounts.map((discount) => <div key={discount}>{discount}</div>)}</div>
        <div><div className="font-bold">Other Eligible Discounts</div>{rated && rating.eligibleDiscounts.map((discount) => <button key={discount} type="button" onClick={discount === 'Multi Policy' ? () => goToStep(3) : focusSnapshot} className="block text-[#0073cf] underline underline-offset-2 hover:text-[#003865]">{discount}</button>)}</div>
      </div>
    </WizardRowShell>
  </WizardCard>;
}

function BillPlans() {
  const { state, rating, updatePointOfSale } = useQuote();
  return <BillPlansCard fieldId="pos.billPlan" name="auto" allPlans={rating.billPlans} selected={state.pointOfSale.billPlan} onChoose={(billPlan) => updatePointOfSale({ billPlan })} termMonths={6} />;
}

function ProductBillPlans({ product }: { product: OtherProductKey }) {
  const { state, updateProduct } = useQuote();
  const rating = rateProduct(product, state);
  return <BillPlansCard fieldId={`billPlan.${product}`} name={product} allPlans={rating.billPlans} selected={state.productQuotes[product]?.billPlan ?? 'PIF'} onChoose={(billPlan) => updateProduct(product, { billPlan })} termMonths={rating.termMonths} />;
}

export function BillPlansCard({ fieldId, name, allPlans, selected, onChoose, termMonths }: { fieldId: string; name: string; allPlans: BillPlanQuote[]; selected: BillPlan; onChoose: (plan: BillPlan) => void; termMonths: number }) {
  const [showAll, setShowAll] = useState(false);
  const error = useFieldError(fieldId);
  const plans = showAll ? allPlans : allPlans.slice(0, INITIAL_PLANS);
  const choose = onChoose;
  return <section id={fieldId} tabIndex={-1} className="w-[880px] overflow-hidden rounded-[3px] border border-[#cfdbe3] bg-white outline-none">
    <div className="flex min-h-[48px] border-b border-[#cfdbe3]"><div className="flex w-[225px] shrink-0 items-center gap-2 border-r border-[#cfdbe3] bg-[#e4ecf1] pl-[21px] font-slab text-[17px] font-bold">Bill Plans*<HelpDot label="Bill Plans" text={fieldHints.billPlan} /></div><div className="flex flex-1 items-center justify-between pl-[13px] pr-[12px]"><span className="text-[14px] font-bold">{termMonths} Month Options</span><button type="button" onClick={() => setShowAll(!showAll)} className="h-[32px] rounded-[3px] bg-[#0073cf] px-[14px] text-[12px] font-bold uppercase text-white outline-none hover:bg-[#003865] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]">{showAll ? 'View Fewer Plans' : 'View All Available Plans'}</button></div></div>
    <div role="radiogroup" aria-label="Bill plans">{plans.map((plan) => {
      const text = planPaymentText(plan);
      return <label key={plan.id} className={`flex min-h-[58px] cursor-pointer border-b border-[#edf1f3] text-[14px] last:border-b-0 hover:bg-[#f6f9fb] ${selected === plan.id ? 'bg-[#f6f9fb]' : ''}`}>
        <span className="flex w-[225px] shrink-0 items-center gap-[12px] border-r border-[#d7e0e6] pl-[21px]"><input type="radio" name={`bill-plan-${name}`} checked={selected === plan.id} onChange={() => choose(plan.id)} className="h-[20px] w-[20px] shrink-0 accent-[#003865]" /><span><span className="block font-medium">{plan.name}</span><span className="block text-[11px] text-[#5c6670]">{plan.detail}</span></span></span>
        <span className="flex flex-1 flex-col justify-center pl-[13px]"><span>{text.line}</span><span className="text-[11px] text-[#5c6670]">{text.sub}</span></span>
        <span className="flex w-[170px] items-center justify-end pr-[16px] text-[12px] text-[#5c6670]">{plan.savings > 0 && `Savings of ${formatCurrency(plan.savings)}`}</span>
      </label>;
    })}</div>
    {error && <div className="px-[21px] pb-2"><InlineError message={error} /></div>}
  </section>;
}

function PremiumChangeBanner() {
  const { state, dismissPremiumChange } = useQuote();
  const change = state.premiumChange;
  if (!change) return null;
  const up = change.to > change.from;
  return <div role="status" className="mb-[20px] flex w-[880px] items-start gap-[10px] rounded-[3px] border border-[#0073cf] bg-[#e8f4fa] px-[16px] py-[12px] text-[14px] leading-[20px]"><Info size={18} className="mt-px shrink-0 text-[#0073cf]" /><span className="flex-1"><b>The premium has changed based on Point of Sale report information.</b> Total Auto Premium {up ? 'increased' : 'decreased'} from {formatCurrency(change.from)} to {formatCurrency(change.to)}. Review coverages and the bill plan with the customer.</span><button type="button" aria-label="Dismiss" onClick={dismissPremiumChange} className="text-[#003865]"><X size={17} /></button></div>;
}

function CoveragesContent() {
  const { state, rated } = useQuote();
  const [details, setDetails] = useState(false);
  const rateError = useFieldError('rate');
  return <>
    <PremiumChangeBanner />
    <div className="space-y-[20px]">
      {state.vehicles.map((vehicle, index) => <VehicleCoverageCard key={vehicle.id} vehicle={vehicle} index={index} count={state.vehicles.length} />)}
      <PolicyCard onViewDetails={() => setDetails(true)} />
      {rated && <BillPlans />}
      {rateError && <div id="rate" tabIndex={-1} className="flex w-[880px] items-center gap-2 rounded-[3px] border border-[#c2185b] bg-[#fdf0f5] px-[16px] py-[10px] text-[14px] font-medium text-[#8e1245] outline-none"><MoneyTag />{rateError}</div>}
    </div>
    {details && <RatingDetails onClose={() => setDetails(false)} />}
  </>;
}

/** Rating state of the other products, shown on the Auto tab so nothing is forgotten. */
function OtherProductsStatus() {
  const { state, setActiveProduct } = useQuote();
  const others = activeProducts(state).filter((key): key is OtherProductKey => key !== 'auto');
  if (!others.length) return null;
  return <div className="mb-[20px] flex w-[880px] flex-wrap gap-x-[20px] gap-y-1 rounded-[3px] border border-[#cfdbe3] bg-white px-[16px] py-[10px] text-[13px]"><span className="font-bold">Other products on this quote:</span>{others.map((key) => <button key={key} type="button" onClick={() => setActiveProduct(key)} className="text-[#0073cf] underline underline-offset-2">{productLabel(key)} {isProductRated(key, state) ? '(rated)' : '(needs RECALCULATE)'}</button>)}</div>;
}

export function CoveragesStep() {
  const { state } = useQuote();
  const product = currentProduct(state);
  return <WizardLayout stepHeader contentClassName="pt-0" sidebar={product === 'auto' ? <SnapshotPromo /> : undefined} actionCenter={<PremiumTotal />}>
    {product === 'auto' ? <><OtherProductsStatus /><CoveragesContent /></> : product === 'renters' ? <RentersCoveragesContent billPlans={isProductRated('renters', state) ? <ProductBillPlans product="renters" /> : null} /> : <ProductCoveragesContent key={product} product={product} billPlans={<ProductBillPlans product={product} />} />}
  </WizardLayout>;
}
