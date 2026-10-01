// Printable Auto Insurance Quote / Binder built from the active session data.
import type { ReactNode } from 'react';
import { BI_PD, COLL_DEDUCTIBLES, ETE, MED_PAY, OTC_DEDUCTIBLES, TOWING, UMPD, UM_BI, optionLabel } from '@/data/options';
import { useQuote } from '@/context/useQuote';
import { formatCurrency } from '@/utils/masks';
import { SCORE_TIER_NAMES, TERM_MONTHS, driverName, incidentLabel, vehicleName } from '@/utils/ratingEngine';
import { paymentSchedule, planPaymentText } from '@/utils/paymentSchedule';
import { activeProducts, hasAuto } from '@/utils/ratingEngine';
import { PRODUCT_CONFIGS } from '@/products/configs';
import { productTotals } from '@/products/engine';
import { productUnits } from '@/services/policyBuilder';
import type { OtherProductKey } from '@/products/types';

export type DocumentKind = 'selected' | 'all' | 'set' | 'binder';

const maskTail = (value: string, keep: number) => {
  const clean = value.replace(/\W/g, '');
  return clean ? `${'•'.repeat(Math.max(0, clean.length - keep))}${clean.slice(-keep)}` : '—';
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-4 break-inside-avoid"><h3 className="mb-1 border-b-2 border-[#003865] pb-0.5 text-[12px] font-bold uppercase tracking-wide text-[#003865]">{title}</h3>{children}</section>;
}

function Table({ head, rows, align = [] }: { head: string[]; rows: ReactNode[][]; align?: ('left' | 'right')[] }) {
  return <table className="w-full border-collapse text-[10.5px]"><thead><tr className="bg-[#e3edf4] text-left">{head.map((cell, i) => <th key={`${cell}-${i}`} className={`border border-[#c6d6e1] px-2 py-1 font-bold ${align[i] === 'right' ? 'text-right' : ''}`}>{cell}</th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i} className={`border border-[#c6d6e1] px-2 py-1 align-top ${align[i] === 'right' ? 'text-right tabular-nums' : ''}`}>{cell}</td>)}</tr>)}</tbody></table>;
}

function Field({ name, value }: { name: string; value: ReactNode }) {
  return <div><div className="text-[8.5px] font-bold uppercase text-[#52616c]">{name}</div><div className="text-[11.5px] font-semibold">{value || '—'}</div></div>;
}

export function QuoteSheet({ kind = 'binder', agencyAddress = 'Agency default' }: { kind?: DocumentKind; agencyAddress?: string }) {
  const { state, rating, rated, plan, summary } = useQuote();
  const { insured, vehicles, drivers, coverages, reports, pointOfSale, policy, additional, agent } = state;
  const bound = Boolean(policy.policyNumber);
  const title = kind === 'binder' ? (bound ? 'Auto Insurance Binder' : 'Auto Insurance Application') : kind === 'set' ? 'Auto Insurance Document Set' : 'Auto Insurance Quote';
  const phone = insured.phones.filter((entry) => entry.number).map((entry) => `${entry.number} (${entry.type})`).join(', ');
  const money = (value: number) => (rated ? formatCurrency(value) : '$ --.--');
  const schedule = paymentSchedule(plan, policy.effectiveDate);
  const auto = hasAuto(state);
  const others = activeProducts(state).filter((key): key is OtherProductKey => key !== 'auto');
  const totals = productTotals(state, rated);
  const issued = state.policies.filter((record) => totals.some((entry) => entry.quoteNumber === record.quoteNumber));

  return <article className="print-area relative mx-auto max-w-[800px] overflow-hidden rounded border border-[#c6d6e1] bg-white px-8 py-6 text-[#28343c] shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="-rotate-[24deg] whitespace-nowrap text-[54px] font-black uppercase tracking-widest text-[#003865]/[.05]">Training Simulation</span></div>
    <header className="flex items-start justify-between border-b-4 border-[#003865] pb-3">
      <div><div className="text-[18px] font-light tracking-[-.5px] text-[#003865]">LAVA<b>TRAINING</b></div><div className="mt-1 text-[10px] text-[#52616c]">Producer: {policy.agentCode} · Agent: {agent.name}</div><div className="text-[10px] text-[#52616c]">Agency address: {agencyAddress}</div></div>
      <div className="text-right"><h2 className="text-[18px] font-bold text-[#003865]">{title}</h2><div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${bound ? 'bg-[#e6f4ef] text-[#05784c]' : 'bg-[#fff6ee] text-[#9a4a0b]'}`}>{bound ? 'Sold' : 'Not Sold'}</div></div>
    </header>
    <p className="mt-2 rounded bg-[#fdf0f1] px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-[#c8102e]">Training simulation only. Not a valid insurance document or proof of coverage.</p>

    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field name="Quote Number" value={summary.quoteNumber} />
      <Field name="Policy Number" value={summary.policyNumber || '—'} />
      <Field name={`Policy Period (${TERM_MONTHS} months)`} value={`${summary.effectiveDate} – ${summary.expirationDate}`} />
      <Field name={bound ? 'Bound On' : 'Prepared On'} value={policy.boundAt || new Date().toLocaleDateString('en-US')} />
    </div>

    <Section title="Named Insured">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field name="Name" value={[insured.firstName, insured.middleInitial, insured.lastName, insured.suffix].filter(Boolean).join(' ')} />
        <Field name="Date of Birth" value={insured.dob} />
        <Field name="Phone" value={phone} />
        <Field name="Mailing Address" value={<>{insured.address.line1}{insured.address.line2 && `, ${insured.address.line2}`}<br />{insured.address.city}, {insured.address.state} {insured.address.zip}</>} />
        <Field name="Email" value={insured.email} />
        <Field name="Primary Residence" value={additional.primaryResidence} />
      </div>
    </Section>

    {auto && <Section title="Vehicles & Coverages (6-month premium)">
      {vehicles.map((vehicle, index) => {
        const premium = rating.vehicles.find((entry) => entry.vehicleId === vehicle.id);
        return <div key={vehicle.id} className="mb-2 break-inside-avoid">
          <div className="mb-1 text-[11px] font-bold">Vehicle {index + 1}: {vehicleName(vehicle)} {vehicle.bodyStyle} · VIN {vehicle.vin || '—'} · Garaged {vehicle.garagingZip}</div>
          <Table head={['Coverage', 'Limit / Deductible', 'Premium']} align={['left', 'left', 'right']} rows={[
            ['Bodily Injury & Property Damage', optionLabel(BI_PD, coverages.bodilyInjuryPd), money(premium?.coverages.bipd ?? 0)],
            ['Medical Payment', optionLabel(MED_PAY, coverages.medicalPayments), money(premium?.coverages.medpay ?? 0)],
            ['Other Than Collision', optionLabel(OTC_DEDUCTIBLES, vehicle.compDeductible), money(premium?.coverages.otc ?? 0)],
            ['Collision', optionLabel(COLL_DEDUCTIBLES, vehicle.collDeductible), money(premium?.coverages.coll ?? 0)],
            ['Extended Transportation Expense', optionLabel(ETE, vehicle.rental), money(premium?.coverages.ete ?? 0)],
            ['Towing and Labor (Roadside)', optionLabel(TOWING, vehicle.roadside), money(premium?.coverages.towing ?? 0)],
            ['Customizing Equipment Coverage', `$${Number(vehicle.customEquipment.replace(/\D/g, '') || 0).toLocaleString('en-US')}`, money(premium?.coverages.cec ?? 0)],
            [<b key="t">Vehicle Total</b>, '', <b key="v">{money(premium?.total ?? 0)}</b>],
          ]} />
        </div>;
      })}
      <Table head={['Policy Coverage', 'Limit', 'Premium']} align={['left', 'left', 'right']} rows={[
        ['Uninsured/Underinsured Motorist Bodily Injury', optionLabel(UM_BI, coverages.uninsuredMotorist), money(rating.umbi)],
        ['Uninsured Motorist Property Damage', optionLabel(UMPD, coverages.umpd), money(rating.umpd)],
        ['DriveSense Enrollment', coverages.snapshot || '—', ''],
      ]} />
    </Section>}

    {others.map((key) => {
      const config = PRODUCT_CONFIGS[key];
      const snapshot = productUnits(state, key);
      const total = totals.find((entry) => entry.key === key);
      const issuedPolicy = issued.find((record) => record.product === key);
      return <Section key={key} title={`${config.name} (${config.termMonths}-month premium) · Quote #${total?.quoteNumber ?? ''}${issuedPolicy ? ` · Policy #${issuedPolicy.policyNumber}` : ''}`}>
        {snapshot.units.map((unit, index) => <div key={index} className="mb-2 break-inside-avoid"><div className="mb-1 text-[11px] font-bold">{config.unitLabel} {index + 1}: {unit.label}{unit.idNumber ? ` · ${config.idField === 'hin' ? 'HIN' : 'VIN'} ${unit.idNumber}` : ''}</div>{unit.details.length > 0 && <p className="mb-1 text-[9.5px] text-[#52616c]">{unit.details.join(' · ')}</p>}{unit.coverages.length > 0 && <Table head={['Coverage', 'Limit / Deductible', 'Premium']} align={['left', 'left', 'right']} rows={[...unit.coverages.map((line) => [line.label, line.value, money(line.premium ?? 0)]), [<b key="t">{config.unitLabel} Total</b>, '', <b key="v">{money(unit.premium)}</b>]]} />}</div>)}
        {snapshot.policy.length > 0 && <Table head={['Policy Coverage', 'Limit', 'Premium']} align={['left', 'left', 'right']} rows={snapshot.policy.map((line) => [line.label, line.value, line.premium ? money(line.premium) : ''])} />}
        {total && <p className="mt-1 text-[10.5px]"><b>{total.plan.name}</b>: {total.rated ? `${planPaymentText(total.plan).line}` : 'RECALCULATE required'}</p>}
      </Section>;
    })}

    <Section title="Drivers & Household Members">
      <Table head={['Name', 'DOB', 'Relationship', 'Status', 'License', 'Incidents']} rows={drivers.map((driver) => [
        driverName(driver), driver.dob, driver.relationship, driver.driverStatus, driver.licenseType === 'Not Licensed' ? 'Not licensed' : `${driver.licenseState} ${maskTail(driver.licenseNumber, 3)}`,
        driver.incidents.length ? driver.incidents.map((incident) => `${incidentLabel(incident.code)} (${incident.date})`).join('; ') : 'None',
      ])} />
    </Section>

    <Section title="Discounts">
      <p className="text-[11px]">{rated && rating.appliedDiscounts.length ? rating.appliedDiscounts.join(' · ') : 'None applied'}</p>
      {rated && !!rating.eligibleDiscounts.length && <p className="text-[10px] text-[#52616c]">Other eligible discounts: {rating.eligibleDiscounts.join(', ')}</p>}
    </Section>

    <Section title="Point of Sale Reports">
      <Table head={['Report', 'Status', 'Results']} rows={[
        ['Auto CLUE (claims & prior insurance)', reports.clueStatus.replace('-', ' ').toUpperCase(), reports.clueStatus === 'not-ordered' ? '—' : [reports.vendor ? `${reports.vendor.liabilityStatus}; ${reports.vendor.carrier}` : '', ...reports.clueFindings].filter(Boolean).join('; ') || 'No losses found'],
        ['MVR (driving record)', reports.mvrStatus.replace('-', ' ').toUpperCase(), reports.mvrStatus === 'not-ordered' ? '—' : reports.mvrFindings.join('; ') || 'No violations found'],
      ]} />
      <p className="mt-1 text-[9.5px] text-[#52616c]">{rating.reportsApplied ? `Rated with Point of Sale results (${SCORE_TIER_NAMES[reports.scoreTier]} tier, ordered ${reports.orderedAt}).` : 'Preliminary rate: subject to change when Point of Sale reports are ordered.'}</p>
    </Section>

    {!auto ? null : kind === 'all' ? <Section title="Bill Plans (6 Month Options)">
      <Table head={['Bill Plan', 'Payment Details', 'Total']} align={['left', 'left', 'right']} rows={rating.billPlans.map((option) => [<span key={option.id}>{option.name}{option.id === plan.id && <b> (selected)</b>}</span>, rated ? planPaymentText(option).line : '—', money(option.total)])} />
    </Section> : <Section title={`Selected Bill Plan: ${plan.name}`}>
      {rated ? <Table head={['Due Date', 'Description', 'Amount']} align={['left', 'left', 'right']} rows={[...schedule.map((row) => [row.due, row.description, formatCurrency(row.amount)]), ['', <b key="t">Total 6-month premium</b>, <b key="v">{formatCurrency(plan.total)}</b>]]} /> : <p className="text-[11px] text-[#52616c]">Click RECALCULATE on Coverages/Bill Plans to generate the premium and payment schedule.</p>}
      {plan.savings > 0 && rated && <p className="mt-1 text-[10px] text-[#05784c]">Pay In Full savings: {formatCurrency(plan.savings)} compared with Pay By Mail.</p>}
    </Section>}

    {(kind === 'set' || kind === 'binder') && <Section title="Application Answers">
      <Table head={['Question', 'Answer']} rows={[
        ['Liability insurance for past 6 months with no more than 31 days lapse', additional.continuousInsurance],
        ['All drivers required to be listed are included', additional.allDriversListed],
        ['Auto policy canceled (except non-payment) within the past 5 years', additional.priorCancellation],
        ['Vehicles owned by a corporation/partnership or jointly outside the household', additional.jointOwnership],
        ['Paperless documents and bills by email', additional.paperless],
        ['Other LAVA products', additional.noAdditionalRisks ? 'No additional risks apply' : additional.crossSell.join(', ') || '—'],
      ]} />
      {pointOfSale.paymentMethod && <p className="mt-1 text-[10px] text-[#52616c]">Payment method: {pointOfSale.paymentMethod} · Documents: {pointOfSale.documentDelivery}</p>}
      {policy.comment && <p className="mt-1 text-[10px] text-[#52616c]">Quote comment: {policy.comment}</p>}
    </Section>}

    {(kind === 'set' || kind === 'binder') && <section className="mt-6 grid grid-cols-2 gap-8 break-inside-avoid text-[9.5px] text-[#52616c]">
      <div className="border-t border-[#28343c] pt-1">Named Insured Signature / Date</div>
      <div className="border-t border-[#28343c] pt-1">Producer Signature / Date</div>
    </section>}
  </article>;
}
