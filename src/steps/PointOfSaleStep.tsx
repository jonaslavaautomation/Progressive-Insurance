import type { BillPlan, YesNo } from '@/types/quote';
import { BILL_PLANS, DOCUMENT_DELIVERY, PAYMENT_METHODS, YES_NO } from '@/data/options';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { formatCurrency } from '@/utils/masks';
import { dueToday } from '@/utils/paymentSchedule';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { WizardCard, WizardCheckbox, WizardRow, WizardSelect } from '@/components/wizard/primitives';
import { RatePanel } from '@/components/quote/RatePanel';

export function PointOfSaleStep() {
  const { state, rating, updatePointOfSale } = useQuote();
  const pos = state.pointOfSale;
  const due = pos.billPlan ? formatCurrency(dueToday(rating, pos.billPlan)) : '';

  return <WizardLayout>
    <div className="flex items-start gap-[20px]">
      <div className="w-[450px] shrink-0 space-y-[20px]">
        <WizardCard title="Bill Plan & Payment">
          <WizardSelect id="pos.billPlan" label="Bill Plan:*" help hint={fieldHints.billPlan} options={BILL_PLANS} value={pos.billPlan} onChange={(billPlan) => updatePointOfSale({ billPlan: billPlan as BillPlan })} />
          <WizardRow label="Amount Due Today" strong value={due} />
          <WizardSelect id="pos.paymentMethod" label="Down Payment Method:*" options={PAYMENT_METHODS} value={pos.paymentMethod} onChange={(paymentMethod) => updatePointOfSale({ paymentMethod })} />
          <WizardSelect id="pos.paymentAuthorized" label="Customer authorized payment?*" options={YES_NO} value={pos.paymentAuthorized} onChange={(paymentAuthorized) => updatePointOfSale({ paymentAuthorized: paymentAuthorized as YesNo })} />
          <WizardSelect id="pos.documentDelivery" label="Document Delivery:*" options={DOCUMENT_DELIVERY} value={pos.documentDelivery} onChange={(documentDelivery) => updatePointOfSale({ documentDelivery })} />
          <p className="px-[21px] py-2 text-[12px] leading-snug text-[#59666e]">Training simulation: never collect real card or bank numbers here. In the live portal, payment details are captured through the carrier's secure payment screen.</p>
        </WizardCard>
        <WizardCard title="Point of Sale Checklist">
          <WizardCheckbox id="pos.reviewedCoverages" label="I reviewed coverages, limits and deductibles with the customer." checked={pos.reviewedCoverages} onChange={(reviewedCoverages) => updatePointOfSale({ reviewedCoverages })} />
          <WizardCheckbox id="pos.confirmedHousehold" label="The customer confirmed all household members age 15+ and all drivers are listed." checked={pos.confirmedHousehold} onChange={(confirmedHousehold) => updatePointOfSale({ confirmedHousehold })} />
          <WizardCheckbox id="pos.agreedToTerms" label="The customer agreed to the binding terms and the application statements are true." checked={pos.agreedToTerms} onChange={(agreedToTerms) => updatePointOfSale({ agreedToTerms })} />
        </WizardCard>
      </div>
      <div className="w-[300px] shrink-0 space-y-[20px]"><RatePanel /></div>
    </div>
  </WizardLayout>;
}
