import { useState } from 'react';
import { Car, Search } from 'lucide-react';
import type { Vehicle, YesNo } from '@/types/quote';
import { ANNUAL_MILES, OWNERSHIP_LENGTHS, PRIMARY_USES, VEHICLE_TYPES, YES_NO } from '@/data/options';
import { MODEL_YEARS, bodyStylesFor, decodeVin, lookupVehicleDetails, makesFor, modelsFor } from '@/data/vehicleCatalog';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { vehicleLabel } from '@/utils/ratingEngine';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddButton, WizardCard, WizardField, WizardRadio, WizardSelect } from '@/components/wizard/primitives';

type Identity = Pick<Vehicle, 'year' | 'make' | 'model' | 'bodyStyle'>;

export function ProductsStep() {
  const { state, updatePolicy, addVehicle, updateVehicle, removeVehicle } = useQuote();
  const { vehicles, policy } = state;
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
    else setVinNotice('VIN not found in the training catalog. Enter Year, Make and Model manually.');
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
  return <WizardLayout onRevealField={revealField}>
    <section className="mx-4 mb-3 grid gap-3 rounded border border-[#c6d6e1] bg-white p-3 lg:grid-cols-2">
      <WizardField id="policy.effectiveDate" label="Policy Effective Date:*" tag placeholder="MM/DD/YYYY" mask="date" value={policy.effectiveDate} onChange={(effectiveDate) => updatePolicy({ effectiveDate })} hint={fieldHints.effectiveDate} />
      <WizardRadio id="policy.namedOperator" label="Named Operator Policy?*" name="operator" help hint={fieldHints.namedOperator} value={policy.namedOperator} onChange={(namedOperator) => updatePolicy({ namedOperator })} className="flex items-center gap-3 text-[10px]" />
    </section>
    <div className="mx-4 grid gap-3 lg:grid-cols-[414px_258px]">
      <WizardCard title="Vehicle" subtitle={<>{description || 'New Vehicle'}<br />{index + 1} of {vehicles.length}</>} onRemove={remove} removeLabel={`Remove ${vehicleLabel(vehicle, index)}`} removeDisabled={vehicles.length === 1}>
        <WizardSelect id={id('vehicleType')} label="Vehicle Type:*" help options={VEHICLE_TYPES} value={vehicle.vehicleType} onChange={(vehicleType) => set({ vehicleType })} />
        <WizardField id={id('vin')} label="VIN:" help hint={fieldHints.vin} placeholder="- or -" mask="vin" value={vehicle.vin} onChange={setVin} icon={<Search size={13} />} />
        {vinNotice && <div className="border-b border-[#edf1f3] px-3 py-1 text-right text-[9px] font-semibold text-[#0073cf]">{vinNotice}</div>}
        <WizardSelect id={id('year')} label="Year:*" help options={MODEL_YEARS} value={vehicle.year} onChange={(year) => setIdentity({ year })} />
        <WizardSelect id={id('make')} label="Make:*" help options={makesFor(vehicle.year)} disabled={!vehicle.year} value={vehicle.make} onChange={(make) => setIdentity({ make })} />
        <WizardSelect id={id('model')} label="Model:*" help options={modelsFor(vehicle.year, vehicle.make)} disabled={!vehicle.make} value={vehicle.model} onChange={(model) => setIdentity({ model })} />
        <WizardSelect id={id('bodyStyle')} label="Body Style:*" help options={bodyStylesFor(vehicle.make, vehicle.model)} disabled={!vehicle.model} value={vehicle.bodyStyle} onChange={(bodyStyle) => setIdentity({ bodyStyle })} />
        <WizardField label="ISO Symbol:" disabled value={vehicle.isoSymbol} hint={fieldHints.isoSymbol} />
        <WizardField label="ISO Symbol OTC:" disabled value={vehicle.isoSymbolOtc} />
        <WizardField label="ISO Symbol Collision:" disabled value={vehicle.isoSymbolCollision} />
        <WizardField id={id('garagingZip')} label="Garaging Zip Code:*" help hint={fieldHints.garagingZip} mask="zip" value={vehicle.garagingZip} onChange={(garagingZip) => set({ garagingZip })} />
        <WizardSelect id={id('ownershipLength')} label="How long has the customer had this vehicle?*" help hint={fieldHints.ownership} options={OWNERSHIP_LENGTHS} value={vehicle.ownershipLength} onChange={(ownershipLength) => set({ ownershipLength })} />
        <WizardSelect id={id('primaryUse')} label="Primary Vehicle Use:*" help hint={fieldHints.primaryUse} options={PRIMARY_USES} value={vehicle.primaryUse} onChange={(primaryUse) => set({ primaryUse })} />
        <WizardSelect id={id('rideshare')} label="Vehicle Used for Rideshare/TNC (Uber, DoorDash, etc.):*" help hint={fieldHints.rideshare} options={YES_NO} value={vehicle.rideshare} onChange={(rideshare) => set({ rideshare: rideshare as YesNo })} />
        <WizardSelect id={id('delivery')} label="Truck/van used for any delivery (excluding Rideshare):*" help hint={fieldHints.delivery} options={YES_NO} value={vehicle.delivery} onChange={(delivery) => set({ delivery: delivery as YesNo })} />
        <WizardField id={id('marketValue')} label="Market Value:*" help hint={fieldHints.marketValue} money mask="money" value={vehicle.marketValue} onChange={(marketValue) => set({ marketValue })} />
        <WizardField id={id('originalCostNew')} label="Original Cost New:*" help money mask="money" value={vehicle.originalCostNew} onChange={(originalCostNew) => set({ originalCostNew })} />
        <WizardSelect label="Passive Restraint:*" tag hint={fieldHints.passiveRestraint} disabled options={[]} value={vehicle.passiveRestraint} />
        <WizardSelect id={id('annualMiles')} label="Annual Miles:*" help hint={fieldHints.annualMiles} options={ANNUAL_MILES} value={vehicle.annualMiles} onChange={(annualMiles) => set({ annualMiles })} />
        <div className="flex min-h-[30px] items-center justify-between border-t border-[#dbe4e8] px-3 text-[10px]"><span>Lienholder:</span><span>None &nbsp; <button className="font-bold underline">Add / Delete</button></span></div>
        <div className="flex min-h-[30px] items-center justify-between border-t border-[#dbe4e8] px-3 text-[10px]"><span>Additional Interest:</span><span>None &nbsp; <button className="font-bold underline">Add / Delete</button></span></div>
      </WizardCard>
      <WizardCard title="Vehicles at Household" className="h-fit">
        {vehicles.length > 1 && <ul>{vehicles.map((entry, i) => <li key={entry.id}><button type="button" onClick={() => setActiveId(entry.id)} className={`flex w-full items-center gap-2 border-b border-[#edf1f3] px-4 py-2 text-left text-[11px] text-[#003865] hover:bg-[#e8f4fa] ${entry.id === vehicle.id ? 'bg-[#e8f4fa] font-bold' : ''}`}><Car size={16} strokeWidth={1.6} />{vehicleLabel(entry, i)}</button></li>)}</ul>}
        <AddButton label="ADD A NEW VEHICLE" onClick={add} />
      </WizardCard>
    </div>
  </WizardLayout>;
}
