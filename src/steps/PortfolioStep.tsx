import { Building2, Car, UserRound } from 'lucide-react';
import { BI_LIMITS, DEDUCTIBLES, PD_LIMITS, UM_LIMITS, tierFor } from '@/data/options';
import { useQuote } from '@/context/useQuote';
import { driverName, vehicleLabel } from '@/utils/ratingEngine';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { WizardCard, WizardRow } from '@/components/wizard/primitives';
import { RatePanel } from '@/components/quote/RatePanel';
import { ReportsPanel } from '@/components/quote/ReportsPanel';

const OWNS_HOME = ['Own home', 'Own condo', 'Own mobile home'];

export function PortfolioStep() {
  const { state, summary, goToStep } = useQuote();
  const { insured, vehicles, drivers, coverages, additional } = state;
  const edit = (step: number) => <button type="button" onClick={() => goToStep(step)} className="text-[13px] font-bold text-[#003865] underline">Edit</button>;
  const bundle = OWNS_HOME.includes(additional.residenceType)
    ? 'Customer owns their residence: offer a Homeowners quote to bundle for a multi-policy discount.'
    : additional.residenceType === 'Rent' ? 'Customer rents: add a Renters (HO4) quote to the portfolio.' : '';

  return <WizardLayout>
    <div className="flex items-start gap-[20px]">
      <div className="w-[450px] shrink-0 space-y-[20px]">
        <WizardCard title="Portfolio" subtitle={<>AUTO<br />Quote #: {summary.quoteNumber}</>}>
          <WizardRow label="Principal Named Insured" value={[insured.firstName, insured.middleInitial, insured.lastName, insured.suffix].filter(Boolean).join(' ')} />
          <WizardRow label="Mailing Address" value={`${insured.address.line1}, ${insured.address.city}, ${insured.address.state} ${insured.address.zip}`} />
          <WizardRow label="Policy Term" value={`${summary.effectiveDate} to ${summary.expirationDate}`} />
          <WizardRow label="Monthly Premium" strong value={`$${summary.monthlyPremium.toFixed(2)}`} />
        </WizardCard>
        <WizardCard title="Vehicles" split={false} subtitle={edit(1)}>
          {vehicles.map((vehicle, index) => <div key={vehicle.id} className="flex items-start gap-2 border-b border-[#edf1f3] px-[21px] py-2 text-[13px]"><Car size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[#003865]" /><div className="flex-1"><div className="font-bold">{vehicleLabel(vehicle, index)} {vehicle.bodyStyle}</div><div className="text-[#52616c]">VIN {vehicle.vin || 'not provided'} · Garaged {vehicle.garagingZip} · {vehicle.primaryUse} · {vehicle.annualMiles} mi/yr</div><div className="text-[#52616c]">Comp {tierFor(DEDUCTIBLES, vehicle.compDeductible)?.label} · Coll {tierFor(DEDUCTIBLES, vehicle.collDeductible)?.label}</div></div></div>)}
        </WizardCard>
        <WizardCard title="Drivers" split={false} subtitle={edit(2)}>
          {drivers.map((driver) => <div key={driver.id} className="flex items-start gap-2 border-b border-[#edf1f3] px-[21px] py-2 text-[13px]"><UserRound size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[#003865]" /><div className="flex-1"><div className="font-bold">{driverName(driver)} <span className="font-semibold text-[#52616c]">({driver.relationship})</span></div><div className="text-[#52616c]">DOB {driver.dob} · {driver.driverStatus} · {driver.licenseType} {driver.licenseState && `(${driver.licenseState})`}</div><div className={driver.incidents.length ? 'font-semibold text-[#c8102e]' : 'text-[#52616c]'}>{driver.incidents.length ? `${driver.incidents.length} incident(s) disclosed` : 'No incidents disclosed'}</div></div></div>)}
        </WizardCard>
        <WizardCard title="Coverages" split={false} subtitle={edit(4)}>
          <WizardRow label="Bodily Injury" value={tierFor(BI_LIMITS, coverages.bodilyInjury)?.label} />
          <WizardRow label="Property Damage" value={tierFor(PD_LIMITS, coverages.propertyDamage)?.label} />
          <WizardRow label="UM/UIM Bodily Injury" value={tierFor(UM_LIMITS, coverages.uninsuredMotorist)?.label} />
          <WizardRow label="Discounts Applied" value={summary.discountsApplied.join(', ') || 'None'} />
        </WizardCard>
        {bundle && <div className="flex items-start gap-2 rounded border border-[#a5c8d8] bg-[#dbf3fc] px-[21px] py-2 text-[14px] text-[#1d5e80]"><Building2 size={16} className="mt-px shrink-0" /><span><b>Bundle opportunity:</b> {bundle}</span></div>}
      </div>
      <div className="w-[300px] shrink-0 space-y-[20px]"><RatePanel breakdownOpen /><ReportsPanel /></div>
    </div>
  </WizardLayout>;
}
