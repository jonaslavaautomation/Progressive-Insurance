import type { Coverages, YesNo } from '@/types/quote';
import { BI_LIMITS, DEDUCTIBLES, MED_PAY, PD_LIMITS, RENTAL, UM_LIMITS, YES_NO, tierOptions } from '@/data/options';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { vehicleLabel } from '@/utils/ratingEngine';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { WizardCard, WizardSelect } from '@/components/wizard/primitives';
import { RatePanel } from '@/components/quote/RatePanel';
import { ReportsPanel } from '@/components/quote/ReportsPanel';

export function CoveragesStep() {
  const { state, updateCoverages, updateVehicle } = useQuote();
  const { coverages, vehicles } = state;
  const set = <K extends keyof Coverages>(field: K) => (value: string) => updateCoverages({ [field]: value } as Partial<Coverages>);

  return <WizardLayout>
    <div className="mx-4 grid gap-3 lg:grid-cols-[414px_300px]">
      <div className="space-y-3">
        <WizardCard title="Policy Coverages" subtitle="All vehicles">
          <WizardSelect id="coverages.bodilyInjury" label="Bodily Injury Liability:*" help hint={fieldHints.bodilyInjury} options={tierOptions(BI_LIMITS)} value={coverages.bodilyInjury} onChange={set('bodilyInjury')} />
          <WizardSelect id="coverages.propertyDamage" label="Property Damage Liability:*" help hint={fieldHints.propertyDamage} options={tierOptions(PD_LIMITS)} value={coverages.propertyDamage} onChange={set('propertyDamage')} />
          <WizardSelect id="coverages.uninsuredMotorist" label="Uninsured/Underinsured Motorist BI:*" help hint={fieldHints.uninsuredMotorist} options={tierOptions(UM_LIMITS)} value={coverages.uninsuredMotorist} onChange={set('uninsuredMotorist')} />
          <WizardSelect id="coverages.medicalPayments" label="Medical Payments:*" help options={tierOptions(MED_PAY)} value={coverages.medicalPayments} onChange={set('medicalPayments')} />
          <WizardSelect id="coverages.roadside" label="Roadside Assistance:*" help options={YES_NO} value={coverages.roadside} onChange={(roadside) => updateCoverages({ roadside: roadside as YesNo })} />
          <WizardSelect id="coverages.rentalReimbursement" label="Rental Reimbursement:*" help options={tierOptions(RENTAL)} value={coverages.rentalReimbursement} onChange={set('rentalReimbursement')} />
        </WizardCard>
        {vehicles.map((vehicle, index) => <WizardCard key={vehicle.id} title="Vehicle Coverages" subtitle={vehicleLabel(vehicle, index)}>
          <WizardSelect id={`vehicle.${vehicle.id}.compDeductible`} label="Comprehensive:*" help hint={index === 0 ? fieldHints.deductibles : undefined} options={tierOptions(DEDUCTIBLES)} value={vehicle.compDeductible} onChange={(compDeductible) => updateVehicle(vehicle.id, { compDeductible })} />
          <WizardSelect id={`vehicle.${vehicle.id}.collDeductible`} label="Collision:*" help options={tierOptions(DEDUCTIBLES)} value={vehicle.collDeductible} onChange={(collDeductible) => updateVehicle(vehicle.id, { collDeductible })} />
        </WizardCard>)}
      </div>
      <div className="space-y-3"><RatePanel breakdownOpen /><ReportsPanel /></div>
    </div>
  </WizardLayout>;
}
