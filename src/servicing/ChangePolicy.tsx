// Change Policy (endorsement) workflow: choose changes and a change date, edit a draft copy of
// the policy's rating source, then review the prorated premium impact and submit.
import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import type { PolicyRecord, PolicySource } from '@/types/policy';
import type { Driver, QuoteData, Vehicle } from '@/types/quote';
import type { CommercialKey, OtherProductKey, ProductConfig, ProductQuote } from '@/products/types';
import { useQuote } from '@/context/useQuote';
import { runWithSpinner } from '@/services/processing';
import { createDriver, createVehicle } from '@/context/quoteStore';
import { ANNUAL_MILES, BI_PD, PIP_OPTIONS, COLL_DEDUCTIBLES, ETE, GENDERS, MARITAL_STATUSES, MED_PAY, OTC_DEDUCTIBLES, PRIMARY_RESIDENCES, PRIMARY_USES, RELATIONSHIPS, TOWING, UM_BI, US_STATES, coverageOptions } from '@/data/options';
import { MODEL_YEARS, bodyStylesFor, decodeVin, lookupVehicleDetails, makesFor, modelsFor } from '@/data/vehicleCatalog';
import { configFor } from '@/products/configs';
import { DRIVER_ACCIDENTS, DRIVER_EXPERIENCE, DRIVER_LICENSE_TYPES, DRIVER_VIOLATIONS } from '@/commercial/configs';
import { createUnit, fieldContext } from '@/products/engine';
import { commercialContext, createCommercialDriver } from '@/commercial/engine';
import { driverName, vehicleName } from '@/utils/ratingEngine';
import { formatCurrency } from '@/utils/masks';
import { ageOn, parseDate } from '@/utils/dates';
import { EMAIL, PHONE, VIN, checkField, setValidationState, type FieldErrors } from '@/utils/validation';
import { rulesFor, stateOptions } from '@/data/states';
import { MAX_BACKDATE_DAYS, MAX_FUTURE_DAYS, applyChange, previewChange, validateChangeDate } from '@/services/endorsement';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';
import { InlineError, SelectControl, TextControl } from '@/components/wizard/primitives';
import { ConfigField } from '@/components/products/Editors';

export type ChangeType = 'address' | 'contact' | 'addVehicle' | 'replaceVehicle' | 'removeVehicle' | 'addDriver' | 'removeDriver' | 'coverages' | 'lienholder' | 'addUnit' | 'removeUnit';
const TYPE_LABELS: Record<ChangeType, string> = {
  address: 'Change address', contact: 'Update phone / email', addVehicle: 'Add a vehicle', replaceVehicle: 'Replace a vehicle', removeVehicle: 'Remove a vehicle',
  addDriver: 'Add a driver', removeDriver: 'Remove or exclude a driver', coverages: 'Change coverages', lienholder: 'Add or remove a lienholder / loss payee',
  addUnit: 'Add a unit', removeUnit: 'Remove a unit',
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block text-[13px] ${wide ? 'col-span-2' : ''}`}><span className="mb-1 block font-medium">{label}</span>{children}</label>;
}

function configOf(policy: PolicyRecord): ProductConfig | undefined {
  return configFor(policy.product);
}

/** The ProductQuote for a config-driven policy (personal toys/renters or commercial). */
function productQuoteOf(source: PolicySource, policy: PolicyRecord): ProductQuote | undefined {
  if (source.kind === 'commercial') return source.quote.productQuotes[policy.product as CommercialKey];
  return source.quote.productQuotes[policy.product as OtherProductKey];
}

function withProductQuote(source: PolicySource, policy: PolicyRecord, update: (quote: ProductQuote) => ProductQuote): PolicySource {
  const draft = clone(source);
  if (draft.kind === 'commercial') { const key = policy.product as CommercialKey; draft.quote.productQuotes[key] = update(draft.quote.productQuotes[key]!); }
  else { const key = policy.product as OtherProductKey; draft.quote.productQuotes[key] = update(draft.quote.productQuotes[key]!); }
  return draft;
}

function availableTypes(policy: PolicyRecord): ChangeType[] {
  if (policy.product === 'auto') return ['address', 'contact', 'addVehicle', 'replaceVehicle', 'removeVehicle', 'addDriver', 'removeDriver', 'coverages', 'lienholder'];
  const config = configOf(policy);
  const types: ChangeType[] = ['address', 'contact'];
  if (config?.multiUnit) types.push('addUnit', 'removeUnit');
  types.push('coverages');
  if (policy.product === 'commercialAuto') types.push('addDriver', 'removeDriver');
  if (config?.idField === 'vin' || config?.idField === 'hin' || policy.product === 'renters') types.push('lienholder');
  return types;
}

function labelFor(type: ChangeType, policy: PolicyRecord): string {
  const config = configOf(policy);
  if (type === 'addUnit') return `Add a ${config?.unitLabel.toLowerCase() ?? 'unit'}`;
  if (type === 'removeUnit') return `Remove a ${config?.unitLabel.toLowerCase() ?? 'unit'}`;
  if (type === 'lienholder' && policy.product === 'renters') return 'Add or remove an interested party (landlord)';
  return TYPE_LABELS[type];
}

interface EditorProps { policy: PolicyRecord; draft: PolicySource; onSave: (draft: PolicySource, description: string, extra?: { vehicles?: boolean; lienholders?: PolicyRecord['lienholders']; added?: PolicyRecord['lienholders'] }) => void; lienholders: PolicyRecord['lienholders']; effectiveDate: string }

// ------------------------------------------------------------------ Address change (guided)

const STREET_WORDS: [RegExp, string][] = [
  [/\bstreet\b/gi, 'ST'], [/\bavenue\b/gi, 'AVE'], [/\blane\b/gi, 'LN'], [/\bdrive\b/gi, 'DR'], [/\bcourt\b/gi, 'CT'], [/\broad\b/gi, 'RD'], [/\bboulevard\b/gi, 'BLVD'],
  [/\bhighway\b/gi, 'HWY'], [/\bcircle\b/gi, 'CIR'], [/\bplace\b/gi, 'PL'], [/\btrail\b/gi, 'TRL'], [/\bparkway\b/gi, 'PKWY'], [/\bterrace\b/gi, 'TER'],
  [/\bnorth\b/gi, 'N'], [/\bsouth\b/gi, 'S'], [/\beast\b/gi, 'E'], [/\bwest\b/gi, 'W'], [/\bapartment\b|\bapt\.?(?=\s|$)/gi, 'APT'], [/\bsuite\b/gi, 'STE'], [/\bunit\b/gi, 'UNIT'],
];
const standardizeLine = (text: string) => STREET_WORDS.reduce((value, [pattern, abbr]) => value.replace(pattern, abbr), text.trim().replace(/[.,]/g, '').replace(/\s+/g, ' ')).toUpperCase();
/** Deterministic ZIP+4 so the same address always verifies the same way. */
const zip4 = (text: string) => String(1000 + ([...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9000, 7) % 9000)).padStart(4, '0');
const PO_BOX = /\bP\.?\s*O\.?\s*BOX\b|\bPOST OFFICE BOX\b/i;

interface AddressDraft { line1: string; line2: string; city: string; state: string; zip: string }

function AddressEditor({ policy, draft, onSave }: EditorProps) {
  const personal = draft.kind === 'personal';
  const current: AddressDraft = personal
    ? { line1: draft.quote.insured.address.line1, line2: draft.quote.insured.address.line2, city: draft.quote.insured.address.city, state: draft.quote.insured.address.state || policy.state, zip: draft.quote.insured.address.zip }
    : { line1: draft.quote.business.street, line2: '', city: draft.quote.business.city, state: draft.quote.business.state || policy.state, zip: draft.quote.business.zip };
  const rules = rulesFor(policy.state);
  const [step, setStep] = useState<'enter' | 'verify' | 'garage'>('enter');
  const [entered, setEntered] = useState<AddressDraft>({ ...current, line1: '', line2: '', city: '', zip: '' });
  const [moved, setMoved] = useState<'moved' | 'mailing'>('moved');
  const [residence, setResidence] = useState(personal ? draft.quote.additional.primaryResidence : '');
  const [useSuggested, setUseSuggested] = useState(true);
  const units = personal
    ? draft.quote.vehicles.map((vehicle) => ({ id: vehicle.id, label: vehicleName(vehicle), zip: vehicle.garagingZip }))
    : (productQuoteOf(draft, policy)?.units ?? []).filter((unit) => 'garagingZip' in unit.values).map((unit) => ({ id: unit.id, label: configOf(policy)?.describe(unit) ?? 'Unit', zip: unit.values.garagingZip }));
  const [garaged, setGaraged] = useState<string[]>(units.map((unit) => unit.id));
  const [error, setError] = useState('');
  const set = (patch: Partial<AddressDraft>) => setEntered({ ...entered, ...patch });
  const suggested: AddressDraft = { line1: standardizeLine(entered.line1), line2: standardizeLine(entered.line2), city: entered.city.trim().toUpperCase(), state: entered.state, zip: `${entered.zip}-${zip4(`${entered.line1}${entered.zip}`)}` };
  const chosen = useSuggested ? suggested : entered;

  const verify = () => {
    if (!entered.line1.trim() || !entered.city.trim()) { setError('Enter the new street address and city.'); return; }
    if (entered.state !== rules.name) { setError(`A move to ${entered.state} can't be handled as a policy change. Quote a new policy in ${entered.state}, then cancel this policy effective the day coverage starts there (after the ${rules.code} plates are surrendered, where required).`); return; }
    if (!rules.zip.test(entered.zip)) { setError(`Enter a valid ${rules.name} ZIP code (${rules.zipHint}).`); return; }
    if (moved === 'moved' && PO_BOX.test(entered.line1)) { setError('A PO Box can be a mailing address, but vehicles must be garaged at a street address. Choose "Mailing address only" or enter the street address.'); return; }
    if (entered.line1.trim().toLowerCase() === current.line1.trim().toLowerCase() && entered.zip === current.zip) { setError('The new address is the same as the address on the policy.'); return; }
    setError('');
    setStep('verify');
  };
  const confirmAddress = () => { setGaraged(moved === 'moved' ? units.map((unit) => unit.id) : []); setStep('garage'); };
  const save = () => {
    const zip = chosen.zip.slice(0, 5);
    const address = { line1: chosen.line1, line2: chosen.line2, city: chosen.city, zip };
    const next = clone(draft);
    if (next.kind === 'personal') {
      next.quote.insured.address = { ...next.quote.insured.address, ...address, state: rules.name, poBox: PO_BOX.test(chosen.line1) };
      next.quote.vehicles = next.quote.vehicles.map((vehicle) => (garaged.includes(vehicle.id) ? { ...vehicle, garagingZip: zip } : vehicle));
      if (residence) next.quote.additional.primaryResidence = residence;
    } else next.quote.business = { ...next.quote.business, street: [chosen.line1, chosen.line2].filter(Boolean).join(' '), city: chosen.city, zip };
    for (const product of Object.values(next.quote.productQuotes)) if (product) product.units = product.units.map((unit) => (garaged.includes(unit.id) ? { ...unit, values: { ...unit.values, garagingZip: zip } } : unit));
    const garagingNote = garaged.length ? `garaging moved to ${zip} for ${garaged.length} of ${units.length} ${personal ? 'vehicle' : 'unit'}${units.length > 1 ? 's' : ''} (territory re-rated)` : 'mailing address only, garaging unchanged';
    onSave(next, `Address changed to ${[chosen.line1, chosen.line2].filter(Boolean).join(' ')}, ${chosen.city} ${chosen.zip} (${useSuggested ? 'USPS-verified' : 'as entered'}); ${garagingNote}`, { vehicles: garaged.length > 0 });
  };

  const steps = ['New address', 'Verify', personal ? 'Vehicles' : 'Units'];
  const index = step === 'enter' ? 0 : step === 'verify' ? 1 : 2;
  return <div>
    <ol className="mb-4 flex gap-2 text-[12px]">{steps.map((label, position) => <li key={label} className={`flex items-center gap-1 rounded-full px-3 py-1 font-bold ${position === index ? 'bg-[#003865] text-white' : position < index ? 'bg-[#e6f4ef] text-[#0b5d3f]' : 'bg-[#eef3f6] text-[#5c6670]'}`}>{position + 1}. {label}</li>)}</ol>
    {step === 'enter' && <div className="grid grid-cols-2 gap-3">
      <p className="col-span-2 rounded-[3px] bg-[#f6f9fb] px-3 py-2 text-[12px]">Current address: <b>{[current.line1, current.line2].filter(Boolean).join(' ')}, {current.city} {current.zip}</b></p>
      <Field label="What changed?" wide><SelectControl value={moved} options={[{ value: 'moved', label: 'Customer moved (mailing and garaging address)' }, { value: 'mailing', label: 'Mailing address only (vehicles stay garaged where they are)' }]} onChange={(value) => setMoved(value as 'moved' | 'mailing')} /></Field>
      <Field label="Street address" wide><TextControl value={entered.line1} onChange={(line1) => set({ line1 })} placeholder="e.g. 120 Oak Sample Street" /></Field>
      <Field label="Apt / suite / unit (optional)"><TextControl value={entered.line2} onChange={(line2) => set({ line2 })} /></Field>
      <Field label="City"><TextControl value={entered.city} onChange={(city) => set({ city })} /></Field>
      <Field label="State"><SelectControl value={entered.state} options={US_STATES} onChange={(state) => set({ state })} /></Field>
      <Field label="ZIP code"><TextControl value={entered.zip} mask="zip" onChange={(zip) => set({ zip })} /></Field>
      {personal && moved === 'moved' && <Field label="Residence at the new address"><SelectControl value={residence} options={PRIMARY_RESIDENCES} onChange={setResidence} /></Field>}
      <p className="col-span-2 text-[12px] text-[#5c6670]">Use the date the customer moved as the change effective date. Rates follow the garaging ZIP, so the premium may go up or down.</p>
      <div className="col-span-2"><InlineError message={error} /><SaveButton onClick={verify} label="Verify Address" /></div>
    </div>}
    {step === 'verify' && <div className="space-y-3 text-[13px]">
      <p>We checked the address against the U.S. Postal Service format. Choose the address to use:</p>
      {([[true, 'Suggested (USPS standardized)', suggested], [false, 'As entered', entered]] as [boolean, string, AddressDraft][]).map(([value, label, address]) => <label key={label} className={`flex cursor-pointer items-start gap-3 rounded-[3px] border px-3 py-2 ${useSuggested === value ? 'border-[#0073cf] bg-[#e8f4fa]' : 'border-[#cfdbe3]'}`}><input type="radio" name="address-choice" checked={useSuggested === value} onChange={() => setUseSuggested(value)} className="mt-1 h-[16px] w-[16px] accent-[#003865]" /><span><b className="block">{label}</b>{[address.line1, address.line2].filter(Boolean).join(' ')}<br />{address.city}, {rules.code} {address.zip}</span></label>)}
      <div className="flex gap-2"><button type="button" onClick={() => setStep('enter')} className={modalButton.secondary}>Edit Address</button><SaveButton onClick={confirmAddress} label="Use This Address" /></div>
    </div>}
    {step === 'garage' && <div className="space-y-3 text-[13px]">
      <p><b>{[chosen.line1, chosen.line2].filter(Boolean).join(' ')}, {chosen.city}, {rules.code} {chosen.zip}</b></p>
      {units.length ? <>
        <p>{moved === 'moved' ? 'Confirm every vehicle now kept overnight at the new address.' : 'Mailing address only: vehicles stay garaged at their current ZIP. Check any that did move.'}</p>
        <ul className="space-y-1">{units.map((unit) => <li key={unit.id}><label className="flex items-center gap-2"><input type="checkbox" checked={garaged.includes(unit.id)} onChange={(event) => setGaraged(event.target.checked ? [...garaged, unit.id] : garaged.filter((entry) => entry !== unit.id))} className="h-[16px] w-[16px] accent-[#003865]" />{unit.label} <span className="text-[#5c6670]">garaged {unit.zip || '—'}{garaged.includes(unit.id) ? ` → ${chosen.zip.slice(0, 5)}` : ''}</span></label></li>)}</ul>
      </> : <p>No garaged units on this policy.</p>}
      <div className="flex gap-2"><button type="button" onClick={() => setStep('verify')} className={modalButton.secondary}>Back</button><SaveButton onClick={save} label="Save Address Change" /></div>
    </div>}
  </div>;
}

function ContactEditor({ draft, onSave }: EditorProps) {
  const personal = draft.kind === 'personal';
  const [email, setEmail] = useState(personal ? draft.quote.insured.email : draft.quote.business.email);
  const [phone, setPhone] = useState(personal ? draft.quote.insured.phones[0]?.number ?? '' : draft.quote.business.phone);
  const [error, setError] = useState('');
  const save = () => {
    if (email && !EMAIL.test(email)) { setError('Enter a valid email address.'); return; }
    if (!PHONE.test(phone)) { setError('Enter a valid 10-digit phone number.'); return; }
    const next = clone(draft);
    if (next.kind === 'personal') { next.quote.insured.email = email; next.quote.insured.phones = [{ ...(next.quote.insured.phones[0] ?? { type: 'Cell' }), number: phone }, ...next.quote.insured.phones.slice(1)]; }
    else next.quote.business = { ...next.quote.business, email, phone };
    onSave(next, 'Contact information updated');
  };
  return <div className="grid grid-cols-2 gap-3"><Field label="Email"><TextControl value={email} onChange={setEmail} /></Field><Field label="Phone"><TextControl value={phone} mask="phone" onChange={setPhone} /></Field><div className="col-span-2"><InlineError message={error} /><SaveButton onClick={save} /></div></div>;
}

// ------------------------------------------------------------------ Vehicles

type Ownership = 'Owned' | 'Financed' | 'Leased';
interface VehicleMeta { acquired: string; ownership: Ownership; lender: { name: string; address: string; loanNumber: string }; copyFrom: string; driverId: string }

function VehicleForm({ draft, initial, onSubmit, submitLabel, effectiveDate, showCoverage }: { draft: { kind: 'personal'; quote: QuoteData }; initial?: Vehicle; onSubmit: (vehicle: Partial<Vehicle>, meta: VehicleMeta) => string; submitLabel?: string; effectiveDate: string; showCoverage: boolean }) {
  const [v, setV] = useState({ year: '', make: '', model: '', bodyStyle: '', vin: '', primaryUse: initial?.primaryUse ?? '1A - Pleasure', annualMiles: initial?.annualMiles ?? '10,000 - 11,999', ownershipLength: 'Less than 1 month', garagingZip: initial?.garagingZip ?? draft.quote.insured.address.zip });
  const rated = draft.quote.drivers.filter((driver) => driver.driverStatus === 'Rated');
  const [meta, setMeta] = useState<VehicleMeta>({ acquired: effectiveDate, ownership: 'Owned', lender: { name: '', address: '', loanNumber: '' }, copyFrom: draft.quote.vehicles[0]?.id ?? 'liability', driverId: rated[0]?.id ?? '' });
  const [error, setError] = useState('');
  const [decoded, setDecoded] = useState('');
  const set = (patch: Partial<typeof v>) => {
    const next = { ...v, ...patch };
    if (!makesFor(next.year).includes(next.make)) next.make = '';
    if (!modelsFor(next.year, next.make).includes(next.model)) next.model = '';
    const bodies = bodyStylesFor(next.make, next.model);
    if (!bodies.includes(next.bodyStyle)) next.bodyStyle = bodies.length === 1 ? bodies[0] : '';
    setV(next);
  };
  const decode = () => {
    const result = decodeVin(v.vin);
    if (!result) { setDecoded('VIN not recognized. Select the year, make and model manually.'); return; }
    set({ ...result });
    setDecoded(`VIN decoded: ${result.year} ${result.make} ${result.model} ${result.bodyStyle}. Confirm it matches the vehicle.`);
  };
  const days = ageOn(meta.acquired) === null ? null : dayDiffStrings(meta.acquired, effectiveDate);
  const submit = () => {
    if (!VIN.test(v.vin)) { setError('Enter the 17-character VIN (no I, O or Q).'); return; }
    if (draft.quote.vehicles.some((vehicle) => vehicle.vin === v.vin && vehicle.id !== initial?.id)) { setError('That VIN is already on the policy.'); return; }
    if (!v.year || !v.make || !v.model || !v.bodyStyle) { setError('Select year, make, model and body style.'); return; }
    if (days === null) { setError('Enter the date the customer took ownership (MM/DD/YYYY).'); return; }
    if (days < 0) { setError('The purchase date cannot be after the change effective date.'); return; }
    if (!rulesFor(draft.quote.policy.quoteState).zip.test(v.garagingZip)) { setError(`The vehicle must be garaged in ${rulesFor(draft.quote.policy.quoteState).name} (${rulesFor(draft.quote.policy.quoteState).zipHint}).`); return; }
    if (meta.ownership !== 'Owned' && (!meta.lender.name.trim() || !meta.lender.address.trim())) { setError(`Enter the ${meta.ownership === 'Leased' ? 'leasing company' : 'lender'} name and mailing address. They are listed on the policy as ${meta.ownership === 'Leased' ? 'lessor' : 'lienholder'}.`); return; }
    if (showCoverage && meta.ownership !== 'Owned' && meta.copyFrom === 'liability') { setError('Financed and leased vehicles need Comprehensive and Collision. Copy coverage from a vehicle that carries them.'); return; }
    if (showCoverage && meta.ownership !== 'Owned') {
      const source = draft.quote.vehicles.find((vehicle) => vehicle.id === meta.copyFrom);
      if (source && (source.compDeductible === 'None' || source.collDeductible === 'None')) { setError(`${vehicleName(source)} has no physical damage coverage. Lenders require Comprehensive and Collision; copy from a different vehicle or add them under Change coverages.`); return; }
    }
    setError(onSubmit({ ...v, ...lookupVehicleDetails(v.year, v.make, v.model, v.bodyStyle) }, meta));
  };
  return <div className="grid max-h-[460px] grid-cols-2 gap-3 overflow-y-auto overflow-x-hidden pr-1 [&>*]:min-w-0">
    <Field label="VIN" wide><span className="flex min-w-0 gap-2"><span className="min-w-0 flex-1"><TextControl value={v.vin} mask="vin" onChange={(vin) => { set({ vin }); setDecoded(''); }} /></span><button type="button" onClick={decode} className={`shrink-0 ${modalButton.secondary}`}>Decode VIN</button></span></Field>
    {decoded && <p className="col-span-2 text-[12px] text-[#0b5d3f]">{decoded}</p>}
    <Field label="Year"><SelectControl value={v.year} options={MODEL_YEARS} onChange={(year) => set({ year })} /></Field>
    <Field label="Make"><SelectControl value={v.make} options={makesFor(v.year)} onChange={(make) => set({ make })} /></Field>
    <Field label="Model"><SelectControl value={v.model} options={modelsFor(v.year, v.make)} onChange={(model) => set({ model })} /></Field>
    <Field label="Body style"><SelectControl value={v.bodyStyle} options={bodyStylesFor(v.make, v.model)} onChange={(bodyStyle) => set({ bodyStyle })} /></Field>
    <Field label="Date the customer took ownership"><TextControl value={meta.acquired} mask="date" onChange={(acquired) => setMeta({ ...meta, acquired })} /></Field>
    <Field label="Ownership"><SelectControl value={meta.ownership} options={['Owned', 'Financed', 'Leased']} onChange={(ownership) => setMeta({ ...meta, ownership: ownership as Ownership })} /></Field>
    {days !== null && days > 30 && <p className="col-span-2 rounded-[3px] bg-[#fff6ee] px-3 py-2 text-[12px] text-[#9a4a0b]">Owned {days} days before the change date. The 30-day newly acquired vehicle grace period has passed, so coverage for this vehicle starts on the change effective date ({effectiveDate}), not the purchase date.</p>}
    {days !== null && days >= 0 && days <= 30 && <p className="col-span-2 text-[12px] text-[#0b5d3f]">Within the 30-day newly acquired vehicle period.</p>}
    {meta.ownership !== 'Owned' && <>
      <Field label={meta.ownership === 'Leased' ? 'Leasing company' : 'Lender (lienholder)'}><TextControl value={meta.lender.name} onChange={(name) => setMeta({ ...meta, lender: { ...meta.lender, name } })} /></Field>
      <Field label="Lender mailing address"><TextControl value={meta.lender.address} onChange={(address) => setMeta({ ...meta, lender: { ...meta.lender, address } })} /></Field>
      <Field label="Loan / lease number (optional)"><TextControl value={meta.lender.loanNumber} onChange={(loanNumber) => setMeta({ ...meta, lender: { ...meta.lender, loanNumber } })} /></Field>
    </>}
    <Field label="Garaging ZIP"><TextControl value={v.garagingZip} mask="zip" onChange={(garagingZip) => set({ garagingZip })} /></Field>
    <Field label="Primary use"><SelectControl value={v.primaryUse} options={PRIMARY_USES} onChange={(primaryUse) => set({ primaryUse })} /></Field>
    <Field label="Annual miles"><SelectControl value={v.annualMiles} options={ANNUAL_MILES} onChange={(annualMiles) => set({ annualMiles })} /></Field>
    {rated.length > 0 && <Field label="Primary driver"><SelectControl value={meta.driverId} options={rated.map((driver) => ({ value: driver.id, label: driverName(driver) }))} onChange={(driverId) => setMeta({ ...meta, driverId })} /></Field>}
    {showCoverage && <Field label="Coverage for this vehicle" wide><SelectControl value={meta.copyFrom} options={[...draft.quote.vehicles.map((vehicle) => ({ value: vehicle.id, label: `Same as ${vehicleName(vehicle)} (OTC ${vehicle.compDeductible}, Collision ${vehicle.collDeductible})` })), { value: 'liability', label: 'Liability only (no Comprehensive or Collision)' }]} onChange={(copyFrom) => setMeta({ ...meta, copyFrom })} /></Field>}
    <div className="col-span-2"><InlineError message={error} /><SaveButton onClick={submit} label={submitLabel} /></div>
  </div>;
}

/** Days from `from` to `to` (MM/DD/YYYY), or null when either date is invalid. */
function dayDiffStrings(from: string, to: string): number | null {
  const a = parseDate(from);
  const b = parseDate(to);
  return a && b ? Math.round((b.getTime() - a.getTime()) / 86_400_000) : null;
}

function lienFor(meta: VehicleMeta, label: string): PolicyRecord['lienholders'][number] | null {
  if (meta.ownership === 'Owned') return null;
  return { id: `lh-${Math.random().toString(36).slice(2, 9)}`, unit: label, name: meta.lender.name.trim(), address: meta.lender.address.trim(), loanNumber: meta.lender.loanNumber.trim(), kind: meta.ownership === 'Leased' ? 'Lessor' : 'Lienholder' };
}

function AddVehicleEditor({ draft, onSave, lienholders, effectiveDate }: EditorProps) {
  if (draft.kind !== 'personal') return null;
  const personal = draft as { kind: 'personal'; quote: QuoteData };
  return <VehicleForm draft={personal} effectiveDate={effectiveDate} showCoverage submitLabel="Add Vehicle" onSubmit={(fields, meta) => {
    const next = clone(personal);
    const source = next.quote.vehicles.find((vehicle) => vehicle.id === meta.copyFrom);
    const coverage = source ? { compDeductible: source.compDeductible, collDeductible: source.collDeductible, rental: source.rental, roadside: source.roadside } : { compDeductible: 'None', collDeductible: 'None', rental: 'None', roadside: 'None' };
    const vehicle = { ...createVehicle(next.quote.insured.address.zip), ...fields, ...coverage, rideshare: 'No' as const, delivery: 'No' as const };
    next.quote.vehicles.push(vehicle);
    if (meta.driverId) next.quote.drivers = next.quote.drivers.map((driver) => (driver.id === meta.driverId && !driver.primaryVehicleId ? { ...driver, primaryVehicleId: vehicle.id } : driver));
    const lien = lienFor(meta, vehicleName(vehicle));
    onSave(next, `Added ${vehicleName(vehicle)} (VIN ${vehicle.vin}), ${meta.ownership.toLowerCase()}, acquired ${meta.acquired}; ${source ? `coverage copied from ${vehicleName(source)}` : 'liability only'}${lien ? `; ${lien.kind.toLowerCase()} ${lien.name}` : ''}`, { vehicles: true, ...(lien ? { lienholders: [...lienholders, lien], added: [lien] } : {}) });
    return '';
  }} />;
}

function ReplaceVehicleEditor({ draft, onSave, lienholders, effectiveDate }: EditorProps) {
  const vehicles = draft.kind === 'personal' ? draft.quote.vehicles : [];
  const [target, setTarget] = useState(vehicles[0]?.id ?? '');
  if (draft.kind !== 'personal') return null;
  const personal = draft as { kind: 'personal'; quote: QuoteData };
  const old = vehicles.find((vehicle) => vehicle.id === target);
  return <div className="space-y-3"><Field label="Vehicle being replaced"><SelectControl value={target} options={vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicleName(vehicle) }))} onChange={setTarget} /></Field>
    <p className="text-[12px] text-[#5c6670]">The new vehicle takes the replaced vehicle&rsquo;s coverages, driver assignment and place on the policy, so there is no gap in coverage. Move the NC plate to the new vehicle or surrender it to the DMV.</p>
    <VehicleForm key={target} draft={personal} initial={old} effectiveDate={effectiveDate} showCoverage={false} submitLabel="Replace Vehicle" onSubmit={(fields, meta) => {
      if (!old) return 'Select the vehicle being replaced.';
      if (meta.ownership !== 'Owned' && (old.compDeductible === 'None' || old.collDeductible === 'None')) return `${vehicleName(old)} has no Comprehensive/Collision. Lenders require both; add them under Change coverages first.`;
      const next = clone(personal);
      next.quote.vehicles = next.quote.vehicles.map((vehicle) => (vehicle.id === old.id ? { ...vehicle, ...fields } : vehicle));
      const newLabel = [fields.year, fields.make, fields.model].join(' ');
      const lien = lienFor(meta, newLabel);
      const kept = lienholders.filter((holder) => holder.unit !== vehicleName(old));
      onSave(next, `Replaced ${vehicleName(old)} with ${newLabel} (VIN ${fields.vin}), acquired ${meta.acquired}${lien ? `; ${lien.kind.toLowerCase()} ${lien.name}` : ''}${kept.length < lienholders.length ? '; prior lienholder removed' : ''}`, { vehicles: true, lienholders: lien ? [...kept, lien] : kept, ...(lien ? { added: [lien] } : {}) });
      return '';
    }} /></div>;
}

const plateOptions = (agency: string) => [
  { value: 'transferred', label: 'Plate moved to a replacement vehicle on this policy' },
  { value: 'surrendered', label: `Plate surrendered to ${agency}` },
  { value: 'insuredElsewhere', label: 'Vehicle is insured on another policy' },
  { value: 'stillRegistered', label: 'Plate is still registered and has not been surrendered' },
];

function RemoveVehicleEditor({ policy, draft, onSave, lienholders }: EditorProps) {
  const plateRule = rulesFor(policy.state).plateSurrender;
  const stateName = rulesFor(policy.state).name;
  const vehicles = draft.kind === 'personal' ? draft.quote.vehicles : [];
  const [target, setTarget] = useState(vehicles[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [plate, setPlate] = useState('');
  const [receipt, setReceipt] = useState('');
  const [error, setError] = useState('');
  if (draft.kind !== 'personal') return null;
  const old = vehicles.find((vehicle) => vehicle.id === target);
  const lien = lienholders.find((holder) => old && holder.unit === vehicleName(old));
  const save = () => {
    if (vehicles.length < 2) { setError('A policy needs at least one vehicle. To remove the last vehicle, surrender the plate and cancel the policy.'); return; }
    if (!reason) { setError('Select why the vehicle is being removed.'); return; }
    if (plateRule && !plate) { setError(`Tell us what happened to the ${stateName} license plate.`); return; }
    if (plateRule && plate === 'stillRegistered') { setError(`${stateName} requires insurance on every registered vehicle. Have the customer surrender the plate at ${plateRule.agency} (or move it to another insured vehicle) first. Otherwise ${plateRule.consequence}`); return; }
    if (plate === 'surrendered' && !receipt.trim()) { setError('Enter the DMV plate surrender receipt number.'); return; }
    const next = clone(draft) as { kind: 'personal'; quote: QuoteData };
    next.quote.vehicles = next.quote.vehicles.filter((vehicle) => vehicle.id !== target);
    next.quote.drivers = next.quote.drivers.map((driver) => (driver.primaryVehicleId === target ? { ...driver, primaryVehicleId: '' } : driver));
    const plateNote = !plateRule ? 'no plate surrender required' : plate === 'surrendered' ? `plate surrendered to ${plateRule.agency} (receipt ${receipt.trim()})` : plate === 'transferred' ? 'plate moved to a replacement vehicle' : 'vehicle insured on another policy';
    onSave(next, `Removed ${vehicleName(old!)} (${reason}); ${plateNote}${lien ? `; ${lien.kind.toLowerCase()} ${lien.name} removed` : ''}`, { vehicles: true, lienholders: lienholders.filter((holder) => holder.unit !== vehicleName(old!)) });
  };
  return <div className="grid grid-cols-2 gap-3">
    <Field label="Vehicle"><SelectControl value={target} options={vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicleName(vehicle) }))} onChange={setTarget} /></Field>
    <Field label="Reason"><SelectControl value={reason} options={['Sold', 'Traded in', 'Replaced (new vehicle already added)', 'Total loss', 'Given away', 'No longer drivable']} onChange={setReason} /></Field>
    {plateRule && <Field label={`${stateName} license plate`} wide><SelectControl value={plate} options={plateOptions(plateRule.agency)} onChange={setPlate} /></Field>}
    {plateRule && plate === 'surrendered' && <Field label="DMV surrender receipt number"><TextControl value={receipt} onChange={setReceipt} /></Field>}
    {lien && <p className="col-span-2 rounded-[3px] bg-[#fff6ee] px-3 py-2 text-[12px] text-[#9a4a0b]">{lien.kind} <b>{lien.name}</b> is listed on this vehicle and will be removed and notified.</p>}
    <p className="col-span-2 text-[12px] text-[#5c6670]">Replacing the vehicle? Add the new one first (or use Replace a vehicle) so there is no gap in coverage.</p>
    <div className="col-span-2"><InlineError message={error} /><SaveButton onClick={save} label="Remove Vehicle" /></div>
  </div>;
}

function AddDriverEditor({ draft, onSave }: EditorProps) {
  const [d, setD] = useState({ firstName: '', lastName: '', dob: '', gender: '', maritalStatus: '', relationship: '', licenseState: draft.kind === 'personal' ? draft.quote.policy.quoteState : draft.quote.business.state, licenseNumber: '', ageFirstLicensed: '16', driverStatus: 'Rated', licenseType: DRIVER_LICENSE_TYPES[0], experience: '', violations: '0', accidents: '0' });
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof d>) => setD({ ...d, ...patch });
  const commercial = draft.kind === 'commercial';
  const save = () => {
    const age = ageOn(d.dob);
    if (!d.firstName || !d.lastName) { setError('Enter the driver name.'); return; }
    if (age === null) { setError('Enter a valid date of birth (MM/DD/YYYY).'); return; }
    if (age < (commercial ? 18 : 15)) { setError(`Drivers must be at least ${commercial ? 18 : 15} years old.`); return; }
    if (!d.licenseNumber) { setError('Enter the driver license number.'); return; }
    const next = clone(draft);
    if (next.kind === 'personal') {
      if (!d.gender || !d.maritalStatus || !d.relationship) { setError('Select gender, marital status and relationship.'); return; }
      const driver: Driver = createDriver({ firstName: d.firstName, lastName: d.lastName, dob: d.dob, gender: d.gender, maritalStatus: d.maritalStatus, relationship: d.relationship, licenseState: d.licenseState, licenseNumber: d.licenseNumber.toUpperCase(), ageFirstLicensed: d.ageFirstLicensed, driverStatus: d.driverStatus as Driver['driverStatus'], licenseType: 'Personal Auto', licenseStatus: 'Valid', internationalYears: 'None', operatorType: 'Occasional', education: 'Some college', employment: 'Business/Sales/Office', occupation: 'Sales Representative' });
      next.quote.drivers.push(driver);
      onSave(next, `Added driver ${driverName(driver)} (${d.driverStatus})`);
    } else {
      if (!d.experience) { setError('Select commercial driving experience.'); return; }
      next.quote.drivers.push({ ...createCommercialDriver(), firstName: d.firstName, lastName: d.lastName, dob: d.dob, licenseState: d.licenseState, licenseNumber: d.licenseNumber.toUpperCase(), licenseType: d.licenseType, experience: d.experience, violations: d.violations, accidents: d.accidents });
      onSave(next, `Added driver ${d.firstName} ${d.lastName} (${d.licenseType})`);
    }
  };
  return <div className="grid grid-cols-2 gap-3">
    <Field label="First name"><TextControl value={d.firstName} onChange={(firstName) => set({ firstName })} /></Field>
    <Field label="Last name"><TextControl value={d.lastName} onChange={(lastName) => set({ lastName })} /></Field>
    <Field label="Date of birth"><TextControl value={d.dob} mask="date" placeholder="MM/DD/YYYY" onChange={(dob) => set({ dob })} className="mt-[8px] w-full" /></Field>
    <Field label="License state"><SelectControl value={d.licenseState} options={US_STATES} onChange={(licenseState) => set({ licenseState })} /></Field>
    <Field label="License number"><TextControl value={d.licenseNumber} onChange={(licenseNumber) => set({ licenseNumber })} /></Field>
    {commercial ? <>
      <Field label="License type"><SelectControl value={d.licenseType} options={DRIVER_LICENSE_TYPES} onChange={(licenseType) => set({ licenseType })} /></Field>
      <Field label="Commercial driving experience"><SelectControl value={d.experience} options={DRIVER_EXPERIENCE} onChange={(experience) => set({ experience })} /></Field>
      <Field label="Violations (3 years)"><SelectControl value={d.violations} options={DRIVER_VIOLATIONS} onChange={(violations) => set({ violations })} /></Field>
      <Field label="At-fault accidents (3 years)"><SelectControl value={d.accidents} options={DRIVER_ACCIDENTS} onChange={(accidents) => set({ accidents })} /></Field>
    </> : <>
      <Field label="Gender"><SelectControl value={d.gender} options={GENDERS} onChange={(gender) => set({ gender })} /></Field>
      <Field label="Marital status"><SelectControl value={d.maritalStatus} options={MARITAL_STATUSES} onChange={(maritalStatus) => set({ maritalStatus })} /></Field>
      <Field label="Relationship to insured"><SelectControl value={d.relationship} options={RELATIONSHIPS} onChange={(relationship) => set({ relationship })} /></Field>
      <Field label="Age first licensed"><TextControl value={d.ageFirstLicensed} mask="digits" onChange={(ageFirstLicensed) => set({ ageFirstLicensed })} /></Field>
      <Field label="Driver status"><SelectControl value={d.driverStatus} options={['Rated', 'Excluded']} onChange={(driverStatus) => set({ driverStatus })} /></Field>
    </>}
    <div className="col-span-2"><InlineError message={error} /><SaveButton onClick={save} label="Add Driver" /></div>
  </div>;
}

function RemoveDriverEditor({ draft, onSave }: EditorProps) {
  const options = draft.kind === 'personal' ? draft.quote.drivers.slice(1).map((driver) => ({ value: driver.id, label: `${driverName(driver)} (${driver.driverStatus})` })) : draft.quote.drivers.map((driver) => ({ value: driver.id, label: `${driver.firstName} ${driver.lastName}` }));
  const [target, setTarget] = useState(options[0]?.value ?? '');
  const [action, setAction] = useState(draft.kind === 'personal' ? 'Exclude from the policy' : 'Remove from the driver schedule');
  const [error, setError] = useState('');
  const save = () => {
    if (!target) { setError(draft.kind === 'personal' ? 'The principal named insured cannot be removed. Only other household members can be removed or excluded.' : 'There are no drivers to remove.'); return; }
    const next = clone(draft);
    if (next.kind === 'personal') {
      const driver = next.quote.drivers.find((entry) => entry.id === target)!;
      if (action === 'Exclude from the policy') { driver.driverStatus = 'Excluded'; onSave(next, `Excluded driver ${driverName(driver)} (signed exclusion form required)`); }
      else { next.quote.drivers = next.quote.drivers.filter((entry) => entry.id !== target); onSave(next, `Removed ${driverName(driver)} (no longer in household)`); }
    } else {
      if (next.quote.drivers.length < 2) { setError('Commercial Auto needs at least one scheduled driver.'); return; }
      const driver = next.quote.drivers.find((entry) => entry.id === target)!;
      next.quote.drivers = next.quote.drivers.filter((entry) => entry.id !== target);
      onSave(next, `Removed driver ${driver.firstName} ${driver.lastName} from the schedule`);
    }
  };
  return <div className="grid grid-cols-2 gap-3"><Field label="Driver"><SelectControl value={target} options={options} onChange={setTarget} /></Field>{draft.kind === 'personal' && <Field label="Action"><SelectControl value={action} options={['Exclude from the policy', 'Remove (no longer lives in household)']} onChange={setAction} /></Field>}<div className="col-span-2"><InlineError message={error} /><SaveButton onClick={save} label="Save Driver Change" /></div></div>;
}

function AutoCoverageEditor({ policy, draft, onSave }: EditorProps) {
  const rules = rulesFor(policy.state);
  const [next, setNext] = useState(() => clone(draft) as { kind: 'personal'; quote: QuoteData });
  const c = next.quote.coverages;
  const setCov = (patch: Partial<typeof c>) => setNext({ ...next, quote: { ...next.quote, coverages: { ...c, ...patch } } });
  const setVehicle = (vehicleId: string, patch: Partial<Vehicle>) => setNext({ ...next, quote: { ...next.quote, vehicles: next.quote.vehicles.map((vehicle) => (vehicle.id === vehicleId ? { ...vehicle, ...patch } : vehicle)) } });
  const [error, setError] = useState('');
  const save = () => {
    const per = (value: string) => (/^\d/.test(value) ? Number(value.split('/')[0]) : 0);
    if (rules.um.rule === 'matchLiability' && per(c.uninsuredMotorist) !== per(c.bodilyInjuryPd)) { setError('New Hampshire requires UM/UIM limits equal to the Bodily Injury limits.'); return; }
    if (c.uninsuredMotorist !== 'Rejected' && per(c.uninsuredMotorist) > per(c.bodilyInjuryPd)) { setError(`UM/UIM limits cannot be higher than Bodily Injury limits in ${rules.name}.`); return; }
    if ((c.uninsuredMotorist === 'Rejected' || c.pip === 'Rejected') && !c.rejectionSigned) { setError(`${rules.name} requires the customer's signed rejection form. Check the box below once it is signed.`); return; }
    if (next.quote.vehicles.some((vehicle) => vehicle.collDeductible !== 'None' && vehicle.compDeductible === 'None')) { setError('Collision requires Other Than Collision coverage on the same vehicle.'); return; }
    onSave(next, 'Coverages changed');
  };
  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-3"><Field label="Bodily Injury & Property Damage"><SelectControl value={c.bodilyInjuryPd} options={coverageOptions(stateOptions(BI_PD, rules.liability))} onChange={(bodilyInjuryPd) => setCov({ bodilyInjuryPd })} /></Field><Field label="UM/UIM Bodily Injury"><SelectControl value={c.uninsuredMotorist} options={coverageOptions(stateOptions(UM_BI, rules.um.choices))} onChange={(uninsuredMotorist) => setCov({ uninsuredMotorist })} /></Field><Field label="Medical Payment"><SelectControl value={c.medicalPayments} options={coverageOptions(stateOptions(MED_PAY, rules.medPay))} onChange={(medicalPayments) => setCov({ medicalPayments })} /></Field>{rules.pip && <Field label="Personal Injury Protection"><SelectControl value={c.pip} options={coverageOptions(stateOptions(PIP_OPTIONS, rules.pip.choices))} onChange={(pip) => setCov({ pip })} /></Field>}</div>
    <p className="text-[12px] text-[#5c6670]"><b>{rules.name}:</b> {rules.minimumText}</p>
    {(c.uninsuredMotorist === 'Rejected' || c.pip === 'Rejected') && <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={c.rejectionSigned} onChange={(event) => setCov({ rejectionSigned: event.target.checked })} className="h-[16px] w-[16px] accent-[#003865]" />The customer signed the {rules.name} rejection form.</label>}
    {next.quote.vehicles.map((vehicle) => <div key={vehicle.id} className="rounded-[3px] border border-[#cfdbe3] p-3"><div className="mb-2 text-[13px] font-bold">{vehicleName(vehicle)}</div><div className="grid grid-cols-4 gap-3">
      <Field label="Other Than Collision"><SelectControl value={vehicle.compDeductible} options={coverageOptions(OTC_DEDUCTIBLES)} onChange={(compDeductible) => setVehicle(vehicle.id, { compDeductible })} /></Field>
      <Field label="Collision"><SelectControl value={vehicle.collDeductible} options={coverageOptions(COLL_DEDUCTIBLES)} onChange={(collDeductible) => setVehicle(vehicle.id, { collDeductible })} /></Field>
      <Field label="Rental (ETE)"><SelectControl value={vehicle.rental} options={coverageOptions(ETE)} onChange={(rental) => setVehicle(vehicle.id, { rental })} /></Field>
      <Field label="Towing and Labor"><SelectControl value={vehicle.roadside} options={coverageOptions(TOWING)} onChange={(roadside) => setVehicle(vehicle.id, { roadside })} /></Field>
    </div></div>)}
    <InlineError message={error} /><SaveButton onClick={save} label="Save Coverages" />
  </div>;
}

function ConfigCoverageEditor({ policy, draft, onSave }: EditorProps) {
  const config = configOf(policy)!;
  const [next, setNext] = useState(() => clone(draft));
  const quote = productQuoteOf(next, policy)!;
  const ctxFor = (values: Record<string, string>) => (next.kind === 'commercial' ? commercialContext(next.quote, values) : fieldContext(next.quote, values));
  const update = (patch: (quote: ProductQuote) => ProductQuote) => setNext(withProductQuote(next, policy, patch));
  const [error, setError] = useState('');
  const save = () => {
    const errors: FieldErrors = {};
    for (const coverage of config.coverages) {
      if (coverage.scope === 'policy') checkField(errors, coverage.key, coverage, quote.coverages[coverage.key] ?? '', '', true);
      else quote.units.forEach((unit) => checkField(errors, `${unit.id}.${coverage.key}`, coverage, unit.coverages[coverage.key] ?? '', `${config.describe(unit)}: `, true));
    }
    if (policy.product === 'mgmt' && quote.coverages.epli === 'No' && quote.coverages.npdo === 'No' && quote.coverages.cyber === 'No') errors.parts = 'Select at least one coverage part.';
    const first = Object.values(errors)[0];
    if (first) { setError(first); return; }
    onSave(next, 'Coverages changed');
  };
  return <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
    {config.coverages.filter((coverage) => coverage.scope === 'policy').length > 0 && <div className="rounded-[3px] border border-[#cfdbe3]">{config.coverages.filter((coverage) => coverage.scope === 'policy').map((coverage) => <ConfigField key={coverage.key} field={coverage} id={`chg.${coverage.key}`} value={quote.coverages[coverage.key] ?? ''} ctx={ctxFor(quote.coverages)} onChange={(value) => update((current) => ({ ...current, coverages: { ...current.coverages, [coverage.key]: value } }))} />)}</div>}
    {quote.units.map((unit) => config.coverages.some((coverage) => coverage.scope === 'unit') && <div key={unit.id} className="rounded-[3px] border border-[#cfdbe3]"><div className="border-b border-[#cfdbe3] bg-[#e4ecf1] px-3 py-2 text-[13px] font-bold">{config.describe(unit)}</div>{config.coverages.filter((coverage) => coverage.scope === 'unit').map((coverage) => <ConfigField key={coverage.key} field={coverage} id={`chg.${unit.id}.${coverage.key}`} value={unit.coverages[coverage.key] ?? ''} ctx={ctxFor(unit.coverages)} onChange={(value) => update((current) => ({ ...current, units: current.units.map((entry) => (entry.id === unit.id ? { ...entry, coverages: { ...entry.coverages, [coverage.key]: value } } : entry)) }))} />)}</div>)}
    <InlineError message={error} /><SaveButton onClick={save} label="Save Coverages" />
  </div>;
}

function AddUnitEditor({ policy, draft, onSave }: EditorProps) {
  const config = configOf(policy)!;
  const zip = draft.kind === 'commercial' ? draft.quote.business.zip : draft.quote.insured.address.zip;
  const [unit, setUnit] = useState(() => createUnit(config, zip));
  const ctx = draft.kind === 'commercial' ? commercialContext(draft.quote, unit.values) : fieldContext(draft.quote, unit.values);
  const [error, setError] = useState('');
  const save = () => {
    const errors: FieldErrors = {};
    for (const field of config.unitFields) checkField(errors, field.key, { ...field, required: field.required || field.posRequired }, unit.values[field.key] ?? '', '', !field.showIf || field.showIf(ctx));
    for (const [, message] of Object.entries(config.unitRules?.(unit.values) ?? {})) errors.rule = message;
    const first = Object.values(errors)[0];
    if (first) { setError(first); return; }
    const count = productQuoteOf(draft, policy)?.units.length ?? 0;
    if (count >= config.maxUnits) { setError(`This policy already has the maximum of ${config.maxUnits} ${config.unitPlural.toLowerCase()}.`); return; }
    onSave(withProductQuote(draft, policy, (quote) => ({ ...quote, units: [...quote.units, unit] })), `Added ${config.unitLabel.toLowerCase()}: ${config.describe(unit)}`, { vehicles: true });
  };
  return <div className="max-h-[420px] overflow-y-auto pr-1"><div className="rounded-[3px] border border-[#cfdbe3]">{config.unitFields.map((field) => <ConfigField key={field.key} field={field} id={`chg.unit.${field.key}`} value={unit.values[field.key] ?? ''} ctx={ctx} onChange={(value) => setUnit({ ...unit, values: { ...unit.values, [field.key]: value } })} />)}</div><div className="mt-2"><InlineError message={error} /><SaveButton onClick={save} label={`Add ${config.unitLabel}`} /></div></div>;
}

function RemoveUnitEditor({ policy, draft, onSave }: EditorProps) {
  const config = configOf(policy)!;
  const units = productQuoteOf(draft, policy)?.units ?? [];
  const [target, setTarget] = useState(units[0]?.id ?? '');
  const [error, setError] = useState('');
  const save = () => {
    if (units.length < 2) { setError(`A policy needs at least one ${config.unitLabel.toLowerCase()}. Cancel the policy instead.`); return; }
    const removed = units.find((unit) => unit.id === target)!;
    onSave(withProductQuote(draft, policy, (quote) => ({ ...quote, units: quote.units.filter((unit) => unit.id !== target) })), `Removed ${config.unitLabel.toLowerCase()}: ${config.describe(removed)}`, { vehicles: true });
  };
  return <div className="space-y-3"><Field label={config.unitLabel}><SelectControl value={target} options={units.map((unit) => ({ value: unit.id, label: config.describe(unit) }))} onChange={setTarget} /></Field><InlineError message={error} /><SaveButton onClick={save} label={`Remove ${config.unitLabel}`} /></div>;
}

function LienholderEditor({ policy, draft, onSave, lienholders }: EditorProps) {
  const renters = policy.product === 'renters';
  const units = policy.product === 'auto' && draft.kind === 'personal' ? draft.quote.vehicles.map((vehicle) => ({ id: vehicle.id, label: vehicleName(vehicle), comp: vehicle.compDeductible, coll: vehicle.collDeductible })) : (productQuoteOf(draft, policy)?.units ?? []).map((unit) => ({ id: unit.id, label: configOf(policy)!.describe(unit), comp: unit.coverages.comp ?? unit.coverages.deductible ?? '', coll: unit.coverages.coll ?? unit.coverages.deductible ?? '' }));
  const [unitId, setUnitId] = useState(units[0]?.id ?? '');
  const [kind, setKind] = useState<'Lienholder' | 'Lessor'>('Lienholder');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loan, setLoan] = useState('');
  const [error, setError] = useState('');
  const unit = units.find((entry) => entry.id === unitId);
  const add = () => {
    if (!unit) return;
    if (!name.trim() || !address.trim()) { setError('Enter the company name and mailing address.'); return; }
    if (!renters && (unit.comp === 'None' || unit.coll === 'None')) { setError('Lenders require physical damage coverage (comprehensive and collision) on a financed or leased unit. Add those coverages first.'); return; }
    const holder = { id: `lh-${Math.random().toString(36).slice(2, 9)}`, unit: unit.label, name: name.trim(), address: address.trim(), loanNumber: loan.trim(), kind: renters ? 'Lienholder' as const : kind };
    onSave(clone(draft), `${renters ? 'Interested party' : kind} added on ${unit.label}: ${holder.name}`, { lienholders: [...lienholders, holder], added: [holder] });
  };
  return <div className="space-y-3">
    {lienholders.length > 0 && <ul className="space-y-1 text-[13px]">{lienholders.map((holder) => <li key={holder.id} className="flex items-center justify-between rounded-[3px] border border-[#cfdbe3] px-3 py-2"><span><b>{holder.name}</b> · {holder.kind} · {holder.unit}{holder.loanNumber ? ` · Loan #${holder.loanNumber}` : ''}</span><button type="button" onClick={() => onSave(clone(draft), `${holder.kind} removed from ${holder.unit}: ${holder.name}`, { lienholders: lienholders.filter((entry) => entry.id !== holder.id) })} className="flex items-center gap-1 text-[12px] font-bold text-[#c8102e] underline"><Trash2 size={13} />Remove</button></li>)}</ul>}
    <div className="grid grid-cols-2 gap-3">
      <Field label={renters ? 'Location' : 'Vehicle / unit'}><SelectControl value={unitId} options={units.map((entry) => ({ value: entry.id, label: entry.label }))} onChange={setUnitId} /></Field>
      {!renters && <Field label="Type"><SelectControl value={kind} options={['Lienholder', 'Lessor']} onChange={(value) => setKind(value as 'Lienholder' | 'Lessor')} /></Field>}
      <Field label={renters ? 'Landlord / property manager' : 'Lender / lessor name'}><TextControl value={name} onChange={setName} /></Field>
      <Field label="Mailing address"><TextControl value={address} onChange={setAddress} /></Field>
      {!renters && <Field label="Loan / account number"><TextControl value={loan} onChange={setLoan} /></Field>}
    </div>
    <InlineError message={error} /><SaveButton onClick={add} label={renters ? 'Add Interested Party' : `Add ${kind}`} />
  </div>;
}

function SaveButton({ onClick, label = 'Save Change' }: { onClick: () => void; label?: string }) {
  return <button type="button" onClick={onClick} className={`mt-2 ${modalButton.blue}`}>{label}</button>;
}

const EDITORS: Record<ChangeType, (props: EditorProps) => ReactNode> = {
  address: AddressEditor, contact: ContactEditor, addVehicle: AddVehicleEditor, replaceVehicle: ReplaceVehicleEditor, removeVehicle: RemoveVehicleEditor,
  addDriver: AddDriverEditor, removeDriver: RemoveDriverEditor, coverages: (props) => (props.policy.product === 'auto' ? <AutoCoverageEditor {...props} /> : <ConfigCoverageEditor {...props} />),
  lienholder: LienholderEditor, addUnit: AddUnitEditor, removeUnit: RemoveUnitEditor,
};

export function ChangePolicyModal({ policy, onClose, initialType }: { policy: PolicyRecord; onClose: (message?: string) => void; initialType?: ChangeType }) {
  setValidationState(policy.state);
  const { state, servicePolicy, engine } = useQuote();
  const day = state.simDate;
  const [stage, setStage] = useState<'select' | 'edit' | 'review'>('select');
  const [effectiveDate, setEffectiveDate] = useState(day);
  const [noLoss, setNoLoss] = useState(false);
  const [type, setType] = useState<ChangeType>(initialType && availableTypes(policy).includes(initialType) ? initialType : availableTypes(policy)[0]);
  const [draft, setDraft] = useState<PolicySource>(() => clone(policy.source));
  const [changes, setChanges] = useState<string[]>([]);
  const [vehiclesChanged, setVehiclesChanged] = useState(false);
  const [lienholders, setLienholders] = useState(policy.lienholders);
  const [added, setAdded] = useState<PolicyRecord['lienholders']>([]);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const preview = useMemo(() => (stage === 'review' ? previewChange(policy, draft, effectiveDate) : null), [stage, policy, draft, effectiveDate]);

  const begin = () => {
    const problem = validateChangeDate(policy, effectiveDate, day, noLoss);
    if (problem) { setError(problem); return; }
    setError('');
    setStage('edit');
  };
  const save: EditorProps['onSave'] = (next, description, extra) => {
    setDraft(next);
    setChanges([...changes, description]);
    if (extra?.vehicles) setVehiclesChanged(true);
    if (extra?.lienholders) setLienholders(extra.lienholders);
    if (extra?.added) setAdded([...added, ...extra.added]);
    setStage('select');
  };
  const submit = () => {
    if (!approved) { setError('Confirm the customer requested these changes and agrees to the premium change.'); return; }
    runWithSpinner('Submitting policy change...', () => {
      const result = servicePolicy(policy.id, (record, today) => applyChange(record, { draft, effectiveDate, changes, vehiclesChanged, lienholders, newLienholders: added }, today));
      if (result) { setError(result); return; }
      onClose(`Policy change processed effective ${effectiveDate}. Amended declarations issued.`);
    }, 1100);
  };
  const Editor = EDITORS[type];
  const backdated = engine.dayDiff(effectiveDate, day) > 0;

  return <Modal title={stage === 'review' ? 'Policy Change Review' : 'Change Policy'} width={820} onClose={() => onClose()} footer={stage === 'select' ? <><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button>{changes.length > 0 && <button type="button" className={modalButton.primary} onClick={() => setStage('review')}>Review Changes</button>}</> : stage === 'review' ? <><button type="button" className={modalButton.secondary} onClick={() => setStage('select')}>Back</button><button type="button" className={modalButton.primary} onClick={submit}>Submit Policy Change</button></> : undefined}>
    <p className="mb-3 text-[13px] text-[#5c6670]">{policy.productName} Policy #{policy.policyNumber} · {policy.insured.name} · Term {policy.effectiveDate} – {policy.expirationDate}</p>
    {stage === 'select' && <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Change effective date"><TextControl value={effectiveDate} mask="date" onChange={(value) => { setEffectiveDate(value); setStage('select'); }} className="mt-[8px] w-full" /></Field>
        <Field label="What is changing?"><SelectControl value={type} options={availableTypes(policy).map((value) => ({ value, label: labelFor(value, policy) }))} onChange={(value) => setType(value as ChangeType)} /></Field>
      </div>
      <p className="mt-2 text-[12px] text-[#5c6670]">Changes may be dated up to {MAX_BACKDATE_DAYS} days back (with a no-loss statement) or {MAX_FUTURE_DAYS} days ahead.</p>
      {backdated && <label className="mt-2 flex items-start gap-2 text-[13px]"><input type="checkbox" checked={noLoss} onChange={(event) => setNoLoss(event.target.checked)} className="mt-px h-[18px] w-[18px] accent-[#003865]" /><span><b>No-loss statement:</b> the customer confirms there have been no accidents, claims or losses since {effectiveDate}.</span></label>}
      {changes.length > 0 && <div className="mt-3 rounded-[3px] border border-[#cfdbe3] bg-[#f6f9fb] px-3 py-2 text-[13px]"><div className="mb-1 font-bold">Pending changes ({changes.length})</div><ul className="list-disc space-y-0.5 pl-5">{changes.map((change, index) => <li key={index}>{change}</li>)}</ul></div>}
      <InlineError message={error} />
      <button type="button" onClick={begin} className={`mt-3 flex items-center gap-2 ${modalButton.blue}`}>{changes.length ? <Plus size={15} /> : <Pencil size={15} />}{changes.length ? 'Add Another Change' : 'Continue'}</button>
    </>}
    {stage === 'edit' && <>
      <div className="mb-3 flex items-center justify-between"><h3 className="font-slab text-[16px] font-bold">{labelFor(type, policy)}</h3><button type="button" onClick={() => setStage('select')} className="flex items-center gap-1 text-[13px] font-bold text-[#0073cf] underline"><ArrowLeft size={14} />Back</button></div>
      <Editor policy={policy} draft={draft} onSave={save} lienholders={lienholders} effectiveDate={effectiveDate} />
    </>}
    {stage === 'review' && preview && <>
      <div className="rounded-[3px] border border-[#cfdbe3] px-3 py-2 text-[13px]"><div className="mb-1 font-bold">Changes effective {effectiveDate}</div><ul className="list-disc space-y-0.5 pl-5">{changes.map((change, index) => <li key={index}>{change}</li>)}</ul></div>
      <table className="mt-3 w-full border-collapse text-[13px]"><tbody>{[
        ['Current term premium (selected bill plan)', formatCurrency(preview.oldPlanTotal)],
        ['New term premium if written today', formatCurrency(preview.newPlanTotal)],
        ['Days remaining in term', `${preview.remainingDays} of ${preview.termDays}`],
        [preview.prorated >= 0 ? 'Prorated additional premium' : 'Prorated return premium', formatCurrency(Math.abs(preview.prorated))],
        ['How it is billed', preview.prorated === 0 ? 'No premium change' : preview.openInstallments ? `Spread across ${preview.openInstallments} remaining installment(s): ${preview.perInstallment >= 0 ? '+' : '−'}${formatCurrency(Math.abs(preview.perInstallment))} each` : preview.prorated > 0 ? 'Billed as a separate installment due in 20 days' : 'Refunded to the original payment method'],
      ].map(([label, value]) => <tr key={label}><td className="border border-[#d7e0e6] px-3 py-[6px]">{label}</td><td className="border border-[#d7e0e6] px-3 py-[6px] text-right font-bold">{value}</td></tr>)}</tbody></table>
      {vehiclesChanged && <p className="mt-2 flex items-start gap-2 text-[12px] text-[#5c6670]"><AlertTriangle size={14} className="mt-px shrink-0 text-[#e87722]" />New ID cards{policy.product === 'auto' ? ' and an FS-1 certificate' : ''} will be issued.</p>}
      <label className="mt-3 flex items-start gap-2 text-[13px]"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} className="mt-px h-[18px] w-[18px] accent-[#003865]" />The customer requested these changes and agrees to the premium change.</label>
      <InlineError message={error} />
    </>}
  </Modal>;
}

