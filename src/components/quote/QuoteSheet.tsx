// Printable "Auto Insurance Binder / Quote Summary". Styled for both screen and print (see index.css).
import type { ReactNode } from 'react';
import { BI_LIMITS, DEDUCTIBLES, INCIDENT_CODES, MED_PAY, PD_LIMITS, RENTAL, UM_LIMITS, tierFor, type CoverageTier } from '@/data/options';
import { useQuote } from '@/context/useQuote';
import { formatCurrency } from '@/utils/masks';
import { driverName } from '@/utils/ratingEngine';
import { paymentSchedule } from '@/utils/paymentSchedule';

const label = (tiers: CoverageTier[], value: string) => tierFor(tiers, value)?.label ?? '—';
const maskTail = (value: string, keep: number) => (value ? `${'•'.repeat(Math.max(0, value.replace(/\W/g, '').length - keep))}${value.replace(/\W/g, '').slice(-keep)}` : '—');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-4 break-inside-avoid"><h3 className="mb-1 border-b-2 border-[#003865] pb-0.5 text-[12px] font-bold uppercase tracking-wide text-[#003865]">{title}</h3>{children}</section>;
}

function Table({ head, rows, align = [] }: { head: string[]; rows: ReactNode[][]; align?: ('left' | 'right')[] }) {
  return <table className="w-full border-collapse text-[10px]"><thead><tr className="bg-[#e3edf4] text-left">{head.map((cell, i) => <th key={cell} className={`border border-[#c6d6e1] px-2 py-1 font-bold ${align[i] === 'right' ? 'text-right' : ''}`}>{cell}</th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i} className={`border border-[#c6d6e1] px-2 py-1 align-top ${align[i] === 'right' ? 'text-right tabular-nums' : ''}`}>{cell}</td>)}</tr>)}</tbody></table>;
}

function Field({ name, value }: { name: string; value: ReactNode }) {
  return <div><div className="text-[8px] font-bold uppercase text-[#52616c]">{name}</div><div className="text-[11px] font-semibold">{value || '—'}</div></div>;
}

export function QuoteSheet() {
  const { state, rating, summary } = useQuote();
  const { insured, vehicles, drivers, coverages, reports, pointOfSale, policy, additional } = state;
  const bound = Boolean(policy.policyNumber);
  const schedule = pointOfSale.billPlan ? paymentSchedule(rating, pointOfSale.billPlan, policy.effectiveDate) : [];
  const scheduleTotal = schedule.reduce((sum, row) => sum + row.amount, 0);
  const phone = insured.phones.filter((entry) => entry.number).map((entry) => `${entry.number} (${entry.type})`).join(', ');

  return <article className="print-area relative mx-auto max-w-[760px] overflow-hidden rounded border border-[#c6d6e1] bg-white px-8 py-6 text-[#28343c] shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="-rotate-[24deg] whitespace-nowrap text-[54px] font-black uppercase tracking-widest text-[#003865]/[.05]">Training Simulation</span></div>
    <header className="flex items-start justify-between border-b-4 border-[#003865] pb-3">
      <div><div className="text-[18px] font-light tracking-[-.7px] text-[#003865]">FOR <b>AGENTSONLY</b></div><div className="mt-1 text-[10px] text-[#52616c]">Producer: {policy.agentCode}</div></div>
      <div className="text-right"><h2 className="text-[18px] font-bold text-[#003865]">{bound ? 'Auto Insurance Binder' : 'Auto Insurance Quote Summary'}</h2><div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${bound ? 'bg-[#e6f4ef] text-[#05784c]' : 'bg-[#fff6ee] text-[#9a4a0b]'}`}>{bound ? 'Bound' : 'Quote: not bound'}</div></div>
    </header>
    <p className="mt-2 rounded bg-[#fdf0f1] px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-[#c8102e]">Training simulation only. Not a valid insurance document or proof of coverage.</p>

    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field name="Quote Number" value={summary.quoteNumber} />
      <Field name="Policy Number" value={summary.policyNumber || 'Assigned at binding'} />
      <Field name="Policy Period" value={`${summary.effectiveDate} – ${summary.expirationDate}`} />
      <Field name={bound ? 'Bound On' : 'Prepared On'} value={policy.boundAt || new Date().toLocaleDateString('en-US')} />
    </div>

    <Section title="Named Insured">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field name="Name" value={[insured.firstName, insured.middleInitial, insured.lastName, insured.suffix].filter(Boolean).join(' ')} />
        <Field name="Date of Birth" value={insured.dob} />
        <Field name="Phone" value={phone} />
        <Field name="Mailing Address" value={<>{insured.address.line1}{insured.address.line2 && `, ${insured.address.line2}`}<br />{insured.address.city}, {insured.address.state} {insured.address.zip}</>} />
        <Field name="Email" value={insured.email} />
        <Field name="Prior Insurance" value={additional.priorInsurance === 'Yes' ? `${additional.priorCarrier} (${additional.priorBiLimits}, ${additional.yearsWithPrior})` : 'None'} />
      </div>
    </Section>

    <Section title="Vehicles">
      <Table head={['#', 'Vehicle', 'VIN', 'Garaging ZIP', 'Use / Miles', 'Comp', 'Coll']} rows={vehicles.map((vehicle, index) => [
        index + 1, [vehicle.year, vehicle.make, vehicle.model, vehicle.bodyStyle].filter(Boolean).join(' '), vehicle.vin || '—', vehicle.garagingZip, `${vehicle.primaryUse} / ${vehicle.annualMiles}`,
        label(DEDUCTIBLES, vehicle.compDeductible).replace(' deductible', ''), label(DEDUCTIBLES, vehicle.collDeductible).replace(' deductible', ''),
      ])} />
    </Section>

    <Section title="Drivers & Household Members">
      <Table head={['Name', 'DOB', 'Relationship', 'Status', 'License', 'SSN', 'Incidents']} rows={drivers.map((driver) => [
        driverName(driver), driver.dob, driver.relationship, driver.driverStatus, driver.licenseType === 'Not Licensed' ? 'Not licensed' : `${driver.licenseState} ${maskTail(driver.licenseNumber, 3)}`, maskTail(driver.ssn, 4),
        driver.incidents.length ? driver.incidents.map((incident) => `${INCIDENT_CODES.find((code) => code.value === incident.code)?.label ?? incident.code} (${incident.date})`).join('; ') : 'None',
      ])} />
    </Section>

    <Section title="Coverages">
      <Table head={['Coverage', 'Limit / Selection']} rows={[
        ['Bodily Injury Liability', label(BI_LIMITS, coverages.bodilyInjury)],
        ['Property Damage Liability', label(PD_LIMITS, coverages.propertyDamage)],
        ['Uninsured/Underinsured Motorist BI', label(UM_LIMITS, coverages.uninsuredMotorist)],
        ['Medical Payments', label(MED_PAY, coverages.medicalPayments)],
        ['Roadside Assistance', coverages.roadside === 'Yes' ? 'Included' : 'No Coverage'],
        ['Rental Reimbursement', label(RENTAL, coverages.rentalReimbursement)],
      ]} />
    </Section>

    <Section title="Report Verification">
      <Table head={['Report', 'Status', 'Findings']} rows={[
        ['MVR (Motor Vehicle Report)', reports.mvrStatus.toUpperCase(), reports.mvrFindings.join('; ') || 'No major violations found'],
        ['CLUE (Loss History)', reports.clueStatus.toUpperCase(), reports.clueFindings.join('; ') || 'No losses found'],
      ]} />
      {reports.verificationDate && <p className="mt-1 text-[9px] text-[#52616c]">Verified {reports.verificationDate}</p>}
    </Section>

    <Section title="Rating Breakdown (Monthly)">
      <Table head={['Factor', 'Amount']} align={['left', 'right']} rows={[
        ...rating.lines.map((line) => [line.label, formatCurrency(line.amount)]),
        [<b key="s">Subtotal</b>, <b key="v">{formatCurrency(rating.subtotal)}</b>],
        ...rating.discounts.map((line) => [line.label, formatCurrency(line.amount)]),
        [<b key="m">Monthly Premium</b>, <b key="v">{formatCurrency(rating.monthlyPremium)}</b>],
      ]} />
    </Section>

    <Section title="Premium Summary">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field name="Monthly Premium" value={formatCurrency(rating.monthlyPremium)} />
        <Field name="12-Month Premium" value={formatCurrency(rating.annualPremium)} />
        <Field name="Paid-in-Full Premium" value={formatCurrency(rating.paidInFullPremium)} />
        <Field name="Discounts Applied" value={summary.discountsApplied.join(', ') || 'None'} />
      </div>
    </Section>

    <Section title={`Payment Schedule${pointOfSale.billPlan ? `: ${pointOfSale.billPlan}` : ''}`}>
      {schedule.length ? <Table head={['Due Date', 'Description', 'Amount']} align={['left', 'left', 'right']} rows={[...schedule.map((row) => [row.due, row.description, formatCurrency(row.amount)]), ['', <b key="t">Total</b>, <b key="v">{formatCurrency(scheduleTotal)}</b>]]} /> : <p className="text-[10px] text-[#52616c]">Select a bill plan at Point of Sale to generate the payment schedule.</p>}
      {pointOfSale.paymentMethod && <p className="mt-1 text-[9px] text-[#52616c]">Payment method: {pointOfSale.paymentMethod} · Documents: {pointOfSale.documentDelivery}</p>}
    </Section>

    <section className="mt-6 grid grid-cols-2 gap-8 break-inside-avoid text-[9px] text-[#52616c]">
      <div className="border-t border-[#28343c] pt-1">Named Insured Signature / Date</div>
      <div className="border-t border-[#28343c] pt-1">Producer Signature / Date</div>
    </section>
  </article>;
}
