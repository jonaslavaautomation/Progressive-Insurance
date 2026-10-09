import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { ReportStatus, YesNo } from '@/types/quote';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { formatCurrency } from '@/utils/masks';
import { SCORE_TIER_NAMES, driverName, vehicleName } from '@/utils/ratingEngine';
import { vendorAnswer, vendorDiffers, type PosOrderResult } from '@/utils/reportSimulator';
import { isLicensed, validateStep } from '@/utils/validation';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { HelpDot, InlineError, WizardCard, WizardField, WizardRadio, WizardRow, WizardRowShell } from '@/components/wizard/primitives';
import { useFieldError, useStepValidation } from '@/components/wizard/stepValidation';
import { Modal } from '@/components/wizard/Modal';
import { ProductField } from '@/components/products/ProductForms';
import { PRODUCT_CONFIGS } from '@/products/configs';
import type { OtherProductKey } from '@/products/types';
import { activeProducts, hasAuto } from '@/utils/ratingEngine';
import { needsLicensedDrivers } from '@/utils/validation';
import { modalButton } from '@/components/wizard/modalStyles';

const AUTO_SECTIONS: [string, string][] = [['pos-ceding', 'Ceding Indicator'], ['pos-vehicle', 'Vehicle Details'], ['pos-auto', 'Auto Details']];

function statusText(status: ReportStatus, findings: string[]): string {
  if (status === 'ordering') return 'Ordering…';
  if (status === 'cleared') return 'Ordered - Cleared';
  if (status === 'flagged') return `Ordered - ${findings.length} item${findings.length > 1 ? 's' : ''} found`;
  return 'Not Ordered';
}

function ReportCheckbox({ id, label, checked, onChange, status, findings, help, disabled }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void; status: ReportStatus; findings: string[]; help: string; disabled: boolean }) {
  const tone = status === 'cleared' ? 'text-[#0b5d3f]' : status === 'flagged' ? 'text-[#c8102e]' : 'text-[#5c6670]';
  return <div className="flex items-start gap-[10px]">
    <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-[1px] h-[22px] w-[22px] shrink-0 accent-[#003865]" />
    <div><label htmlFor={id} className="flex items-center gap-2 text-[14px]">{label}<HelpDot label={label.replace('*', '')} text={help} /></label><div className={`flex items-center gap-1 text-[12px] font-medium ${tone}`}>{status === 'ordering' && <Loader2 size={12} className="animate-spin" />}{statusText(status, findings)}</div></div>
  </div>;
}

function VendorDialog({ result, onCancel, onContinue }: { result: PosOrderResult; onCancel: () => void; onContinue: (source: 'vendor' | 'insured') => void }) {
  const { state } = useQuote();
  const [source, setSource] = useState<'vendor' | 'insured'>('vendor');
  const { vendor } = result;
  const insured = state.additional.continuousInsurance || '—';
  const differs = vendorAnswer(vendor) !== state.additional.continuousInsurance;
  const cell = 'border-b border-[#d7e0e6] px-[16px] py-[14px] align-top text-left';
  const radio = (value: 'vendor' | 'insured', label: string) => <label className="flex cursor-pointer items-center gap-[10px] font-bold"><input type="radio" name="history-source" checked={source === value} onChange={() => setSource(value)} className="h-[20px] w-[20px] accent-[#003865]" />{label}</label>;
  return <Modal title="Auto Insurance History" width={920} onClose={onCancel} footer={<><button type="button" className={modalButton.secondary} onClick={onCancel}>Cancel</button><button type="button" autoFocus className={modalButton.primary} onClick={() => onContinue(source)}>Continue</button></>}>
    <p className="text-[14px] leading-[21px]">The vendor provided data differs from the insured provided data.</p>
    <p className="text-[14px] leading-[21px]">Do not click &lsquo;Continue&rsquo; unless the insured agrees with the information provided by the vendor.</p>
    <table className="mt-[20px] w-full border-collapse border border-[#d7e0e6] text-[14px] leading-[20px]"><thead><tr className="bg-[#f6f9fb]"><th className={`${cell} w-[330px]`} /><th className={`${cell} border-l border-[#d7e0e6]`}>{radio('vendor', 'Vendor Provided')}</th><th className={`${cell} border-l border-[#d7e0e6]`}>{radio('insured', 'Insured Provided')}</th></tr></thead><tbody>
      <tr><td className={cell}>Insured/Spouse has vehicle liability insurance for past 6 months with no more than 31 days lapse:</td><td className={`${cell} border-l border-[#d7e0e6]`}>{vendor.liabilityStatus}</td><td className={`${cell} border-l border-[#d7e0e6]`}><span className="flex items-center gap-[10px]">{differs && <AlertTriangle size={18} className="shrink-0 fill-[#e87722] text-white" aria-label="Differs from vendor" />}<span className="flex h-[38px] w-[150px] items-center rounded-[4px] border border-[#cdd5db] bg-[#f2f4f5] px-[12px] text-[#5c6670]">{insured}</span></span></td></tr>
      <tr><td className={cell}>Prior Auto Insurance Carrier:</td><td className={`${cell} border-l border-[#d7e0e6]`}>{vendor.carrier}</td><td className={`${cell} border-l border-[#d7e0e6]`}>{state.additional.priorCarrier || '—'}</td></tr>
      <tr><td className={cell}>Bodily Injury limits on most recent policy:</td><td className={`${cell} border-l border-[#d7e0e6]`}>{vendor.biLimits}</td><td className={`${cell} border-l border-[#d7e0e6]`}>{state.additional.priorLimits || '—'}</td></tr>
      <tr><td className={cell}>Length with most recent carrier:</td><td className={`${cell} border-l border-[#d7e0e6]`}>{vendor.length}</td><td className={`${cell} border-l border-[#d7e0e6]`}>{state.additional.priorYears || '—'}</td></tr>
    </tbody></table>
    {source === 'insured' && <p className="mt-[12px] flex items-start gap-2 text-[13px] text-[#9a4a0b]"><AlertTriangle size={16} className="mt-px shrink-0" />Using insured provided data. Proof of prior insurance will be required, and the rate will not receive verified prior-insurance credit.</p>}
  </Modal>;
}

const SCORE_RESULTS = ['Preferred', 'Standard', 'Nonstandard', 'High Risk'];
const PRIOR_RESULTS: [string, string][] = [['stated', "Confirms the applicant's answers"], ['lapsed', 'Finds a lapse in coverage'], ['none', 'Finds no prior insurance']];

/** Trainer Mode: choose the simulated credit and prior-insurance report results before ordering. */
function TrainerReportSettings({ disabled }: { disabled: boolean }) {
  const { state, updateReports } = useQuote();
  const simulation = state.reports.simulation ?? { scoreTier: 1, prior: 'stated' as const };
  if (!state.trainerMode) return null;
  const select = 'mt-[4px] h-[30px] w-full rounded-[3px] border border-[#8b98a3] bg-white px-[6px] text-[13px]';
  return <div className="mb-[20px] w-[990px] rounded-[3px] border border-dashed border-[#e87722] bg-[#fff6ee] px-[16px] py-[10px] text-[13px] text-[#2e3a43]">
    <div className="font-bold text-[#9a4a0b]">Trainer: simulated report results</div>
    <p className="mt-[2px] text-[12px] text-[#5c6670]">Reports are simulated. CLUE and MVR return the accidents and violations entered for each driver. Choose what the credit and prior-insurance reports return, then order (or re-order) the reports.</p>
    <div className="mt-[8px] grid grid-cols-2 gap-[16px]">
      <label className="font-bold">Insurance score (credit report)<select disabled={disabled} value={simulation.scoreTier} onChange={(event) => updateReports({ simulation: { ...simulation, scoreTier: Number(event.target.value) } })} className={select}>{SCORE_RESULTS.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>
      <label className="font-bold">Prior insurance report<select disabled={disabled} value={simulation.prior} onChange={(event) => updateReports({ simulation: { ...simulation, prior: event.target.value as 'stated' | 'lapsed' | 'none' } })} className={select}>{PRIOR_RESULTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
  </div>;
}

function OrderResults() {
  const { state, goToStep } = useQuote();
  const { reports, premiumChange } = state;
  if (!reports.priorSource) return null;
  const findings = [...reports.clueFindings.map((finding) => `CLUE: ${finding}`), ...reports.mvrFindings.map((finding) => `MVR: ${finding}`)];
  return <div role="status" className="mb-[20px] w-[990px] rounded-[3px] border border-[#0f7a52] bg-[#e6f4ef] px-[16px] py-[12px] text-[14px] leading-[20px] text-[#0b3d2a]">
    <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} className="text-[#0f7a52]" />Point of Sale ordered {reports.orderedAt}.</div>
    <ul className="mt-1 list-disc pl-[46px]">
      <li>Insurance score: {SCORE_TIER_NAMES[reports.scoreTier]} (credit-based)</li>
      <li>Prior insurance: {reports.priorSource === 'vendor' && reports.vendor ? `vendor data accepted (${reports.vendor.liabilityStatus}${reports.vendor.carrier.startsWith('NO ') ? '' : `, ${reports.vendor.carrier}`})` : 'insured provided data used (unverified)'}</li>
      {findings.length ? findings.map((finding) => <li key={finding}>{finding}</li>) : <li>No losses or violations found on ordered reports.</li>}
    </ul>
    {premiumChange && <p className="mt-2 flex items-start gap-2"><Info size={17} className="mt-px shrink-0 text-[#0073cf]" /><span>The premium changed from <b>{formatCurrency(premiumChange.from)}</b> to <b>{formatCurrency(premiumChange.to)}</b>. <button type="button" onClick={() => goToStep(4)} className="font-bold text-[#0073cf] underline underline-offset-2">Review Coverages/Bill Plans</button></span></p>}
  </div>;
}

function PosContent() {
  const { state, updateReports, updateVehicle, updateDriver, updateUnitValues, orderPointOfSale, applyPosOrder, cancelPosOrder } = useQuote();
  const auto = hasAuto(state);
  const others = activeProducts(state).filter((key): key is OtherProductKey => key !== 'auto');
  const licensing = needsLicensedDrivers(state);
  const sections: [string, string][] = [...(auto ? AUTO_SECTIONS : []), ...(others.length ? [['pos-products', 'Other Product Details'] as [string, string]] : []), ['pos-household', 'Household Member Details']];
  const { reports, vehicles, drivers, insured } = state;
  const { reveal } = useStepValidation();
  const posError = useFieldError('pos');
  const [pending, setPending] = useState<PosOrderResult | null>(null);
  const [active, setActive] = useState<string>(auto ? AUTO_SECTIONS[0][0] : others.length ? 'pos-products' : 'pos-household');
  const [selectError, setSelectError] = useState('');
  const busy = reports.clueStatus === 'ordering' || reports.mvrStatus === 'ordering';

  const order = async () => {
    setSelectError('');
    // Point of Sale requires VINs, garaging and license numbers before the vendor order.
    const blocking = Object.keys(validateStep(6, state)).filter((key) => key !== 'pos');
    if (blocking.length) { reveal(); return; }
    if (!reports.orderClue && !reports.orderMvr) { setSelectError('Select at least one report to order.'); return; }
    const clue = reports.orderClue;
    const result = await orderPointOfSale();
    if (!result) return;
    // The prior-insurance comparison applies to the Auto policy.
    if (clue && auto && vendorDiffers(result.vendor, state)) setPending(result);
    else applyPosOrder(result, 'vendor');
  };
  const jump = (id: string) => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return <>
    <div className="mb-[20px] flex items-start gap-[34px]">
      <button type="button" onClick={() => void order()} disabled={busy} className="flex h-[44px] items-center gap-2 rounded-[3px] border-2 border-[#0073cf] bg-[#0073cf] px-[18px] text-[12.5px] font-bold uppercase text-white outline-none hover:border-[#003865] hover:bg-[#003865] focus-visible:border-[#003865] focus-visible:bg-[#003865] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722] disabled:cursor-wait disabled:opacity-80">{busy && <Loader2 size={16} className="animate-spin" />}{busy ? 'Ordering…' : 'Order Point of Sale'}</button>
      <ReportCheckbox id="pos.orderClue" label="Auto CLUE (Used in Auto)*" checked={reports.orderClue} disabled={busy} onChange={(orderClue) => updateReports({ orderClue })} status={reports.clueStatus} findings={reports.clueFindings} help={fieldHints.clue} />
      <ReportCheckbox id="pos.orderMvr" label="MVR (Used in Auto/Toys)*" checked={reports.orderMvr} disabled={busy} onChange={(orderMvr) => updateReports({ orderMvr })} status={reports.mvrStatus} findings={reports.mvrFindings} help={`${fieldHints.mvr} Uncheck MVR to avoid agency fee charges.`} />
    </div>
    {selectError && <p className="-mt-2 mb-3 text-[13px] font-medium text-[#c8102e]">{selectError}</p>}
    {reports.staleReason && <p className="mb-[16px] flex w-[990px] items-start gap-2 rounded-[3px] border border-[#f5a45d] bg-[#fff6ee] px-[16px] py-[10px] text-[14px] text-[#9a4a0b]"><AlertTriangle size={17} className="mt-px shrink-0" />{reports.staleReason}</p>}
    {posError && <div id="pos" tabIndex={-1} className="mb-[16px] w-[990px] outline-none"><InlineError message={posError} /></div>}
    <TrainerReportSettings disabled={busy} />
    <OrderResults />
    <div className="flex items-start gap-[24px]">
      <nav aria-label="Point of Sale sections" className="sticky top-0 w-[160px] shrink-0 pt-[4px]"><ul className="space-y-[10px]">{sections.map(([id, label]) => <li key={id}><button type="button" onClick={() => jump(id)} className={`relative block w-full py-[2px] pl-[12px] text-left text-[14px] underline-offset-2 ${active === id ? 'font-medium text-[#2e3a43] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-[#003865]' : 'text-[#003865] underline hover:text-[#0073cf]'}`}>{label}</button></li>)}</ul></nav>
      <div className="w-[460px] shrink-0 space-y-[20px]">
        {auto && <><section id="pos-ceding" className="scroll-mt-4"><WizardCard title="Ceding Indicator" split={false}><ul className="list-disc py-[14px] pl-[42px] text-[14px]"><li><span className="inline-flex items-center gap-2">Ceding Indicator: R <HelpDot label="Ceding Indicator" text="R = Regular (voluntary) market. The policy is retained by the carrier and not ceded to the North Carolina Reinsurance Facility." /></span></li></ul></WizardCard></section>
        <div id="pos-vehicle" className="scroll-mt-4 space-y-[20px]">{vehicles.map((vehicle, index) => <WizardCard key={vehicle.id} title="Vehicle Details" subtitle={<>{vehicleName(vehicle)}<br />{index + 1} of {vehicles.length}</>}>
          <WizardRow label="Year / Make / Model" value={vehicleName(vehicle)} />
          <WizardRow label="Body Style" value={vehicle.bodyStyle} />
          <WizardRow label="Primary Use" value={vehicle.primaryUse} />
          <WizardRow label="Annual Miles" value={vehicle.annualMiles} />
        </WizardCard>)}</div>
        <div id="pos-auto" className="scroll-mt-4 space-y-[20px]">{vehicles.map((vehicle, index) => {
          const same = vehicle.garagingSameAsMailing !== 'No';
          const id = (field: string) => `vehicle.${vehicle.id}.${field}`;
          return <WizardCard key={vehicle.id} title="Auto Details" subtitle={<>{vehicleName(vehicle)}<br />{index + 1} of {vehicles.length}</>}>
            <WizardField id={id('vin')} label="VIN:*" help hint={fieldHints.vin} mask="vin" value={vehicle.vin} onChange={(vin) => updateVehicle(vehicle.id, { vin })} />
            <WizardRowShell label="Lienholder:" help><span className="flex h-[38px] items-center gap-[60px]"><span>None</span><button type="button" className="underline underline-offset-2">Add / Delete</button></span></WizardRowShell>
            <WizardRowShell label="Additional Interest:" help><span className="flex h-[38px] items-center gap-[60px]"><span>None</span><button type="button" className="underline underline-offset-2">Add / Delete</button></span></WizardRowShell>
            <WizardRadio id={id('garagingSameAsMailing')} name={`garaging-${vehicle.id}`} label="Garaging Address same as Mailing Address:*" hint={fieldHints.garaging} value={vehicle.garagingSameAsMailing} onChange={(value: YesNo) => updateVehicle(vehicle.id, { garagingSameAsMailing: value })} />
            <WizardField id={id('garagingStreet')} label="Garaging Street Address:*" disabled={same} value={same ? '' : vehicle.garagingStreet} onChange={(garagingStreet) => updateVehicle(vehicle.id, { garagingStreet })} />
            <WizardField id={id('garagingStreet2')} label="Garaging Street Second Address Line:" disabled={same} value={same ? '' : vehicle.garagingStreet2} onChange={(garagingStreet2) => updateVehicle(vehicle.id, { garagingStreet2 })} />
            <WizardField id={id('garagingCity')} label="Garaging City:*" disabled={same} value={same ? '' : vehicle.garagingCity} onChange={(garagingCity) => updateVehicle(vehicle.id, { garagingCity })} />
            <WizardField id={id('garagingZip')} label="Garaging ZIP Code:*" mask="zip" value={vehicle.garagingZip} onChange={(garagingZip) => updateVehicle(vehicle.id, { garagingZip })} />
            {same && <p className="px-[21px] pb-[10px] text-[12px] text-[#5c6670]">Garaged at mailing address: {[insured.address.line1, insured.address.city].filter(Boolean).join(', ') || '—'}</p>}
          </WizardCard>;
        })}</div>
        </>}
        {others.length > 0 && <div id="pos-products" className="scroll-mt-4 space-y-[20px]">{others.flatMap((key) => {
          const config = PRODUCT_CONFIGS[key];
          const units = state.productQuotes[key]?.units ?? [];
          const idField = config.unitFields.find((field) => field.key === config.idField);
          return units.map((unit, index) => <WizardCard key={unit.id} title={`${config.unitLabel} Details`} subtitle={<>{config.describe(unit)}<br />{index + 1} of {units.length}</>}>
            <WizardRow label="Product" value={config.name} />
            {idField && <ProductField field={{ ...idField, label: `${idField.label.replace(/:$/, '')}:*` }} id={`unit.${key}.${unit.id}.${idField.key}`} value={unit.values[idField.key] ?? ''} values={unit.values} onChange={(value) => updateUnitValues(key, unit.id, { [idField.key]: value })} />}
            {key === 'renters' && <WizardRow label="Rental Location" value={unit.values.sameAsMailing === 'No' ? `${unit.values.street}, ${unit.values.city} ${unit.values.garagingZip}` : `${insured.address.line1}, ${insured.address.city} ${insured.address.zip}`} />}
            <WizardRow label={key === 'renters' ? 'ZIP Code' : 'Garaging / Storage ZIP'} value={unit.values.garagingZip} />
          </WizardCard>);
        })}</div>}
        <div id="pos-household" className="scroll-mt-4 space-y-[20px]">{drivers.map((driver, index) => <WizardCard key={driver.id} title="Household Member Details" subtitle={<>{driverName(driver)}<br />{index + 1} of {drivers.length}</>}>
          <WizardField label="Date of Birth:" disabled value={driver.dob} />
          <WizardField id={`driver.${driver.id}.licenseNumber`} label={`Driver License Number:${licensing && driver.driverStatus === 'Rated' && isLicensed(driver) ? '*' : ''}`} disabled={!isLicensed(driver)} value={driver.licenseNumber} onChange={(licenseNumber) => updateDriver(driver.id, { licenseNumber: licenseNumber.toUpperCase().slice(0, 16) })} />
          <WizardField label="License State:" disabled value={isLicensed(driver) ? driver.licenseState : 'Not Licensed'} />
          <WizardField id={`driver.${driver.id}.ssn`} label="Social Security Number:" placeholder="XXX-XX-XXXX" mask="ssn" value={driver.ssn} onChange={(ssn) => updateDriver(driver.id, { ssn })} />
        </WizardCard>)}</div>
      </div>
    </div>
    {pending && <VendorDialog result={pending} onCancel={() => { setPending(null); cancelPosOrder(); }} onContinue={(source) => { applyPosOrder(pending, source); setPending(null); }} />}
  </>;
}

export function PointOfSaleStep() {
  return <WizardLayout contentClassName="pt-[20px]"><PosContent /></WizardLayout>;
}
