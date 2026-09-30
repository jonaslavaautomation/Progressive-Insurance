import { AlertTriangle, CheckCircle2, Printer } from 'lucide-react';
import type { YesNo } from '@/types/quote';
import { DOCUMENT_DELIVERY, PAYMENT_METHODS, YES_NO } from '@/data/options';
import { useQuote } from '@/context/useQuote';
import { runWithSpinner } from '@/services/processing';
import { LAST_STEP, STEPS } from '@/context/quoteStore';
import { formatCurrency } from '@/utils/masks';
import { incompleteSteps } from '@/utils/validation';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { WizardCard, WizardCheckbox, WizardRow, WizardSelect } from '@/components/wizard/primitives';
import { useStepValidation } from '@/components/wizard/stepValidation';
import { QuoteSheet } from '@/components/quote/QuoteSheet';
import { productTotals } from '@/products/engine';
import { productLabel } from '@/products/configs';

const button = 'flex h-[40px] items-center gap-2 rounded-[3px] border-2 px-[16px] text-[12.5px] font-bold uppercase outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';

function FinalSaleContent() {
  const { state, rated, bindPolicy, goToStep, showDashboard, showDocuments, resetQuote, updatePointOfSale, openPolicy, openPolicies } = useQuote();
  const totals = productTotals(state, rated);
  const allRated = totals.every((entry) => entry.rated);
  const dueToday = totals.reduce((sum, entry) => sum + entry.plan.dueToday, 0);
  const termTotal = totals.reduce((sum, entry) => sum + entry.plan.total, 0);
  const issued = state.policies.filter((record) => totals.some((entry) => entry.quoteNumber === record.quoteNumber));
  const { reveal } = useStepValidation();
  const pos = state.pointOfSale;
  const incomplete = incompleteSteps(state);
  const earlier = incomplete.filter((step) => step < LAST_STEP);
  const bound = Boolean(state.policy.policyNumber);
  const bind = () => { if (incomplete.includes(LAST_STEP)) { reveal(); return; } runWithSpinner('Binding and issuing policies...', bindPolicy, 1400); };
  const startNew = () => { if (window.confirm('Start a new quote? The bound policy stays available in Manage Policies.')) { resetQuote(); goToStep(0); } };

  return <div className="w-[990px] space-y-[20px] print:w-auto">
    {earlier.length > 0 && <div role="alert" className="rounded-[3px] border border-[#c8102e] bg-[#fdf0f1] px-[16px] py-[12px] text-[14px] print:hidden"><div className="flex items-center gap-2 font-bold text-[#c8102e]"><AlertTriangle size={17} /> The policy cannot be bound until these steps are complete:</div><ul className="mt-1 flex flex-wrap gap-3 pl-6">{earlier.map((step) => <li key={step}><button type="button" onClick={() => goToStep(step)} className="font-bold text-[#003865] underline">{STEPS[step]}</button></li>)}</ul></div>}
    {bound && <div className="rounded-[3px] border border-[#0f7a52] bg-[#e6f4ef] px-[16px] py-[12px] text-[14px] text-[#0b5d3f] print:hidden"><div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} /> {issued.length} polic{issued.length === 1 ? 'y' : 'ies'} issued on {state.policy.boundAt}.</div><ul className="mt-2 space-y-1 pl-[26px]">{issued.map((record) => <li key={record.id}>{record.productName} Policy #{record.policyNumber} · {record.billPlanName} · <button type="button" onClick={() => openPolicy(record.id)} className="font-bold text-[#0073cf] underline underline-offset-2">View Policy</button></li>)}</ul><p className="mt-2 text-[13px]">Service these policies (payments, cancellation, renewal, documents) from <button type="button" onClick={() => openPolicies()} className="font-bold text-[#0073cf] underline underline-offset-2">Manage Policies</button>.</p></div>}
    {!bound && <div className="flex items-start gap-[20px] print:hidden">
      <WizardCard title="Payment" className="w-[460px] shrink-0">
        {totals.map((entry) => <WizardRow key={entry.key} label={`${productLabel(entry.key)} (${entry.termMonths} mo)`} value={`${entry.plan.name} · ${entry.rated ? formatCurrency(entry.plan.dueToday) : '$ --.--'} today`} />)}
        <WizardRow label="Total Due Today" strong value={allRated ? formatCurrency(dueToday) : '$ --.--'} />
        <WizardRow label="Total Term Premium" value={allRated ? formatCurrency(termTotal) : '$ --.--'} />
        <WizardSelect id="pos.paymentMethod" label="Down Payment Method:*" options={PAYMENT_METHODS} value={pos.paymentMethod} onChange={(paymentMethod) => updatePointOfSale({ paymentMethod })} />
        <WizardSelect id="pos.paymentAuthorized" label="Customer authorized payment?*" options={YES_NO} value={pos.paymentAuthorized} onChange={(paymentAuthorized) => updatePointOfSale({ paymentAuthorized: paymentAuthorized as YesNo })} />
        <WizardSelect id="pos.documentDelivery" label="Document Delivery:*" options={DOCUMENT_DELIVERY} value={pos.documentDelivery} onChange={(documentDelivery) => updatePointOfSale({ documentDelivery })} />
        <p className="px-[21px] py-[10px] text-[12px] leading-[17px] text-[#5c6670]">Training simulation: never collect real card or bank numbers. Payment details are captured through the carrier&rsquo;s secure payment screen.</p>
      </WizardCard>
      <WizardCard title="Final Sale Checklist" split={false} className="w-[460px] shrink-0">
        <WizardCheckbox id="pos.reviewedCoverages" label="I reviewed coverages, limits and deductibles with the customer." checked={pos.reviewedCoverages} onChange={(reviewedCoverages) => updatePointOfSale({ reviewedCoverages })} />
        <WizardCheckbox id="pos.confirmedHousehold" label="The customer confirmed all household members age 15+ and all drivers are listed." checked={pos.confirmedHousehold} onChange={(confirmedHousehold) => updatePointOfSale({ confirmedHousehold })} />
        <WizardCheckbox id="pos.agreedToTerms" label="The customer agreed to the binding terms and the application statements are true." checked={pos.agreedToTerms} onChange={(agreedToTerms) => updatePointOfSale({ agreedToTerms })} />
      </WizardCard>
    </div>}
    <div className="flex flex-wrap gap-[12px] print:hidden">
      {!bound && <button type="button" disabled={earlier.length > 0} onClick={bind} className={`${button} border-[#0073cf] bg-[#0073cf] text-white hover:border-[#003865] hover:bg-[#003865] disabled:cursor-not-allowed disabled:border-[#9fb9cf] disabled:bg-[#9fb9cf]`}>{totals.length > 1 ? `Bind ${totals.length} Policies` : 'Bind Policy'}</button>}
      <button type="button" onClick={() => window.print()} className={`${button} border-[#0073cf] bg-white text-[#003865] hover:bg-[#e8f4fa]`}><Printer size={15} /> Print Binder</button>
      <button type="button" onClick={showDocuments} className={`${button} border-[#0073cf] bg-white text-[#003865] hover:bg-[#e8f4fa]`}>Print/Email/Fax</button>
      {bound && <><button type="button" onClick={showDashboard} className={`${button} border-[#0073cf] bg-white text-[#003865] hover:bg-[#e8f4fa]`}>Return to Dashboard</button><button type="button" onClick={startNew} className={`${button} border-[#0073cf] bg-white text-[#003865] hover:bg-[#e8f4fa]`}>Start New Quote</button></>}
    </div>
    <QuoteSheet kind="binder" />
  </div>;
}

export function FinalSaleStep() {
  return <WizardLayout><FinalSaleContent /></WizardLayout>;
}
