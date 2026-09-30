import { useRef, useState } from 'react';
import { CalendarDays, Car, Search } from 'lucide-react';
import type { Vehicle, YesNo } from '@/types/quote';
import { ANNUAL_MILES, OWNERSHIP_LENGTHS, PRIMARY_USES, VEHICLE_TYPES, YES_NO } from '@/data/options';
import { MODEL_YEARS, bodyStylesFor, decodeVin, lookupVehicleDetails, makesFor, modelsFor } from '@/data/vehicleCatalog';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { vehicleLabel } from '@/utils/ratingEngine';
import { applyMask } from '@/utils/masks';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddButton, HelpDot, HintBubble, InlineError, MoneyTag, RadioPair, WizardCard, WizardField, WizardRowShell, WizardSelect, errorRing, focusRing } from '@/components/wizard/primitives';
import { useFieldError } from '@/components/wizard/stepValidation';
import { ProductUnitsContent } from '@/components/products/ProductForms';
import { currentProduct } from '@/products/active';

type Identity = Pick<Vehicle, 'year' | 'make' | 'model' | 'bodyStyle'>;

/** Policy Effective Date + Named Operator strip above the vehicle cards. */
function PolicyStrip({ auto = true }: { auto?: boolean }) {
  const { state, updatePolicy } = useQuote();
  const { policy } = state;
  const dateError = useFieldError('policy.effectiveDate');
  const operatorError = useFieldError('policy.namedOperator');
  const picker = useRef<HTMLInputElement>(null);
  const openPicker = () => { try { picker.current?.showPicker(); } catch { picker.current?.focus(); } };
  const fromPicker = (iso: string) => { const [y, m, d] = iso.split('-'); if (y && m && d) updatePolicy({ effectiveDate: `${m}/${d}/${y}` }); };
  return <section className="flex min-h-[60px] w-[987px] items-stretch rounded-[3px] border border-[#cfdbe3] bg-white text-[14px] text-[#2e3a43]">
    <div className="flex w-[460px] shrink-0 items-start py-[10px] pl-[21px]">
      <label htmlFor="policy.effectiveDate" className="flex h-[38px] w-[150px] items-center gap-1.5">Policy Effective Date:*<HintBubble text={fieldHints.effectiveDate} /></label>
      <span className="flex h-[38px] items-center"><MoneyTag /></span>
      <span className="ml-[13px] w-[212px]"><span className="relative block">{policy.effectiveDate && <span className="pointer-events-none absolute -top-[7px] left-[10px] bg-white px-[3px] text-[11px] leading-[12px]">MM/DD/YYYY</span>}<input id="policy.effectiveDate" value={policy.effectiveDate} placeholder="MM/DD/YYYY" aria-invalid={!!dateError} onChange={(event) => updatePolicy({ effectiveDate: applyMask('date', event.target.value) })} className={`h-[38px] w-full rounded-[4px] border bg-white pl-[15px] text-[14px] outline-none ${dateError ? errorRing : 'border-[#7b8a95]'} ${focusRing}`} /></span><InlineError message={dateError} /></span>
      <button type="button" aria-label="Open calendar" onClick={openPicker} className="relative ml-[9px] mt-[6px] flex h-[26px] w-[26px] items-center justify-center rounded-[3px] border border-[#5c6670] text-[#2e3a43] hover:bg-[#e8f4fa]"><CalendarDays size={18} strokeWidth={1.7} /><input ref={picker} type="date" tabIndex={-1} aria-hidden onChange={(event) => fromPicker(event.target.value)} className="pointer-events-none absolute inset-0 opacity-0" /></button>
    </div>
    {auto ? <div className="flex flex-1 items-start border-l border-[#d7e0e6] py-[10px] pl-[21px]">
      <span className="flex h-[38px] w-[249px] items-center gap-1.5">Named Operator Policy?*<HintBubble text={fieldHints.namedOperator} /></span>
      <span className="flex h-[38px] items-center"><HelpDot label="Named Operator Policy" text={fieldHints.namedOperator} /></span>
      <span id="policy.namedOperator" tabIndex={-1} className="ml-[20px] outline-none"><span className={`flex h-[38px] items-center gap-[30px] rounded px-1 ${operatorError ? 'shadow-[inset_0_0_0_1px_#c8102e]' : ''}`}><RadioPair name="operator" value={policy.namedOperator} onChange={(namedOperator) => updatePolicy({ namedOperator })} /></span><InlineError message={operatorError} /></span>
    </div> : <div className="flex flex-1 items-center border-l border-[#d7e0e6] pl-[21px] text-[13px] text-[#5c6670]">All products on this quote share the policy effective date.</div>}
  </section>;
}

function InterestRow({ label, divider = false }: { label: string; divider?: boolean }) {
  return <WizardRowShell label={label} help divider={divider}><span className="flex h-[38px] items-center gap-[60px] text-[14px]"><span>None</span><button type="button" className="underline underline-offset-2 hover:text-[#003865]">Add / Delete</button></span></WizardRowShell>;
}

function AutoProductsStep() {
  const { state, addVehicle, updateVehicle, removeVehicle } = useQuote();
  const { vehicles } = state;
  const [activeId, setActiveId] = useState(vehicles[0].id);
  const [vinNotice, setVinNotice] = useState('');
  const vehicle = vehicles.find((entry) => entry.id === activeId) ?? vehicles[0];
  const index = vehicles.indexOf(vehicle);
  const id = (field: keyof Vehicle) => `vehicle.${vehicle.id}.${field}`;
  const set = (patch: Partial<Vehicle>) => updateVehicle(vehicle.id, patch);

  // Changing year/make/model clears choices that no longer exist, then refreshes the ISO lookup.
  const setIdentity = (patch: Partial<Identity>) => {
    const next: Identity = { year: vehicle.year, make: vehicle.make, model: vehicle.model, bodyStyle: vehicle.bodyStyle, ...patch };
    if (!makesFor(next.year).includes(next.make)) next.make = '';
    if (!modelsFor(next.year, next.make).includes(next.model)) next.model = '';
    const bodies = bodyStylesFor(next.make, next.model);
    if (!bodies.includes(next.bodyStyle)) next.bodyStyle = bodies.length === 1 ? bodies[0] : '';
    set({ ...next, ...lookupVehicleDetails(next.year, next.make, next.model, next.bodyStyle) });
  };

  const setVin = (vin: string) => {
    set({ vin });
    if (vin.length < 17) { setVinNotice(''); return; }
    const decoded = decodeVin(vin);
    if (decoded) { setVinNotice(`VIN decoded: ${decoded.year} ${decoded.make} ${decoded.model}`); setIdentity(decoded); }
    else setVinNotice('VIN not found. Enter Year, Make and Model.');
  };

  const add = () => { setActiveId(addVehicle()); setVinNotice(''); };
  const remove = () => {
    const fallback = vehicles[index === 0 ? 1 : index - 1];
    removeVehicle(vehicle.id);
    if (fallback) setActiveId(fallback.id);
  };
  const revealField = (fieldId: string) => {
    const [, vehicleId] = fieldId.split('.');
    if (fieldId.startsWith('vehicle.') && vehicles.some((entry) => entry.id === vehicleId)) setActiveId(vehicleId);
  };

  const description = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return <WizardLayout stepHeader contentClassName="pt-0" onRevealField={revealField}>
    <PolicyStrip />
    <div className="mt-[20px] flex items-start gap-[20px]">
      <WizardCard title="Vehicle" className="w-[450px] shrink-0" subtitle={<>{description || `Vehicle ${index + 1} of ${vehicles.length}`}<br />{index + 1} of {vehicles.length}</>} onRemove={remove} removeLabel={`Remove ${vehicleLabel(vehicle, index)}`} removeDisabled={vehicles.length === 1}>
        <WizardSelect id={id('vehicleType')} label="Vehicle Type:*" help options={VEHICLE_TYPES} value={vehicle.vehicleType} onChange={(vehicleType) => set({ vehicleType })} />
        <WizardField id={id('vin')} label="VIN:" note="- or -" help hint={fieldHints.vin} divider mask="vin" value={vehicle.vin} onChange={setVin} icon={<Search size={17} strokeWidth={2} />} />
        {vinNotice && <div className="-mt-[6px] pb-[4px] pl-[235px] text-[12px] font-medium text-[#0073cf]">{vinNotice}</div>}
        <WizardSelect id={id('year')} label="Year:*" help options={MODEL_YEARS} value={vehicle.year} onChange={(year) => setIdentity({ year })} />
        <WizardSelect id={id('make')} label="Make:*" help options={makesFor(vehicle.year)} value={vehicle.make} onChange={(make) => setIdentity({ make })} />
        <WizardSelect id={id('model')} label="Model:*" help options={modelsFor(vehicle.year, vehicle.make)} value={vehicle.model} onChange={(model) => setIdentity({ model })} />
        <WizardSelect id={id('bodyStyle')} label="Body Style:*" options={bodyStylesFor(vehicle.make, vehicle.model)} value={vehicle.bodyStyle} onChange={(bodyStyle) => setIdentity({ bodyStyle })} />
        <WizardField label="ISO Symbol:" disabled value={vehicle.isoSymbol} hint={fieldHints.isoSymbol} />
        <WizardField label="ISO Symbol OTC:" disabled value={vehicle.isoSymbolOtc} />
        <WizardField label="ISO Symbol Collision:" disabled value={vehicle.isoSymbolCollision} />
        <WizardField id={id('garagingZip')} label="Garaging Zip Code:*" help hint={fieldHints.garagingZip} mask="zip" value={vehicle.garagingZip} onChange={(garagingZip) => set({ garagingZip })} />
        <WizardSelect id={id('ownershipLength')} label="How long has the customer had this vehicle?*" help hint={fieldHints.ownership} options={OWNERSHIP_LENGTHS} value={vehicle.ownershipLength} onChange={(ownershipLength) => set({ ownershipLength })} />
        <WizardSelect id={id('primaryUse')} label="Primary Vehicle Use:*" help hint={fieldHints.primaryUse} options={PRIMARY_USES} value={vehicle.primaryUse} onChange={(primaryUse) => set({ primaryUse })} />
        <WizardSelect id={id('rideshare')} label="Vehicle Used for Rideshare/TNC (Uber, DoorDash, etc.):*" help hint={fieldHints.rideshare} options={YES_NO} value={vehicle.rideshare} onChange={(rideshare) => set({ rideshare: rideshare as YesNo })} />
        <WizardSelect id={id('delivery')} label="Truck/van used for any delivery (excluding Rideshare):*" help hint={fieldHints.delivery} options={YES_NO} value={vehicle.delivery} onChange={(delivery) => set({ delivery: delivery as YesNo })} />
        <WizardField id={id('marketValue')} label="Market Value:*" help hint={fieldHints.marketValue} money disabled value={vehicle.marketValue} />
        <WizardField id={id('originalCostNew')} label="Original Cost New:*" help money disabled value={vehicle.originalCostNew} />
        <WizardField label="Passive Restraint:*" tag hint={fieldHints.passiveRestraint} disabled value={vehicle.passiveRestraint} />
        <WizardSelect id={id('annualMiles')} label="Annual Miles:*" help hint={fieldHints.annualMiles} options={ANNUAL_MILES} value={vehicle.annualMiles} onChange={(annualMiles) => set({ annualMiles })} />
        <InterestRow label="Lienholder:" />
        <InterestRow label="Additional Interest:" divider />
      </WizardCard>
      <WizardCard title="Vehicles at Household" split={false} className="w-[280px] shrink-0">
        {vehicles.length > 1 && <ul>{vehicles.map((entry, i) => <li key={entry.id}><button type="button" onClick={() => setActiveId(entry.id)} className={`flex w-full items-center gap-2 border-b border-[#edf1f3] px-[21px] py-[11px] text-left text-[14px] text-[#003865] hover:bg-[#e8f4fa] ${entry.id === vehicle.id ? 'bg-[#eef3f6] font-bold' : ''}`}><Car size={18} strokeWidth={1.6} />{vehicleLabel(entry, i)}</button></li>)}</ul>}
        <AddButton label="ADD A NEW VEHICLE" onClick={add} />
      </WizardCard>
    </div>
  </WizardLayout>;
}

/** Products step: the Auto vehicle screen, or the selected product's units. */
export function ProductsStep() {
  const { state } = useQuote();
  const product = currentProduct(state);
  if (product === 'auto') return <AutoProductsStep key="auto" />;
  return <WizardLayout stepHeader contentClassName="pt-0"><PolicyStrip auto={false} /><ProductUnitsContent key={product} product={product} /></WizardLayout>;
}
