import type { AdditionalDetails, YesNo } from '@/types/quote';
import { PRIOR_BI_LIMITS, PRIOR_CARRIERS, RESIDENCE_TYPES, YEARS_AT_RESIDENCE, YEARS_WITH_PRIOR, YES_NO } from '@/data/options';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { PAPERLESS_SAVINGS } from '@/utils/ratingEngine';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { WizardCard, WizardSelect } from '@/components/wizard/primitives';
import { RatePanel } from '@/components/quote/RatePanel';

export function AdditionalDetailsStep() {
  const { state, updateAdditional } = useQuote();
  const { additional } = state;
  const set = <K extends keyof AdditionalDetails>(field: K) => (value: string) => updateAdditional({ [field]: value } as Partial<AdditionalDetails>);
  const setPrior = (value: string) => updateAdditional(value === 'Yes' ? { priorInsurance: 'Yes' } : { priorInsurance: value as YesNo, priorCarrier: '', priorBiLimits: '', yearsWithPrior: '' });
  const noPrior = additional.priorInsurance !== 'Yes';

  return <WizardLayout>
    <div className="flex items-start gap-[20px]">
      <div className="w-[450px] shrink-0 space-y-[20px]">
        <WizardCard title="Prior Insurance">
          <WizardSelect id="additional.priorInsurance" label="Does the customer currently have auto insurance?*" help hint={fieldHints.priorInsurance} options={YES_NO} value={additional.priorInsurance} onChange={setPrior} />
          <WizardSelect id="additional.priorCarrier" label="Current Carrier:*" disabled={noPrior} options={PRIOR_CARRIERS} value={additional.priorCarrier} onChange={set('priorCarrier')} />
          <WizardSelect id="additional.priorBiLimits" label="Current Bodily Injury Limits:*" help disabled={noPrior} options={PRIOR_BI_LIMITS} value={additional.priorBiLimits} onChange={set('priorBiLimits')} />
          <WizardSelect id="additional.yearsWithPrior" label="Years With Current Carrier:*" disabled={noPrior} options={YEARS_WITH_PRIOR} value={additional.yearsWithPrior} onChange={set('yearsWithPrior')} />
        </WizardCard>
        <WizardCard title="Residence">
          <WizardSelect id="additional.residenceType" label="Residence Type:*" help hint={fieldHints.residence} options={RESIDENCE_TYPES} value={additional.residenceType} onChange={set('residenceType')} />
          <WizardSelect id="additional.yearsAtResidence" label="Years at Current Address:*" options={YEARS_AT_RESIDENCE} value={additional.yearsAtResidence} onChange={set('yearsAtResidence')} />
        </WizardCard>
        <WizardCard title="Policy Preferences">
          <WizardSelect id="additional.paperless" label={`Paperless documents (saves $${PAPERLESS_SAVINGS}/mo):*`} tag hint={fieldHints.paperless} options={YES_NO} value={additional.paperless} onChange={set('paperless')} />
          <WizardSelect id="additional.eSignature" label="e-Signature for policy documents:*" help options={YES_NO} value={additional.eSignature} onChange={set('eSignature')} />
        </WizardCard>
      </div>
      <div className="w-[300px] shrink-0 space-y-[20px]"><RatePanel /></div>
    </div>
  </WizardLayout>;
}
