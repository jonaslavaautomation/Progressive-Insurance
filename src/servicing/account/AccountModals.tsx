// Dialogs opened from Policy and Coverages: delivery method, Deductible Savings Bank, DriveSense,
// loyalty, driving record, quick driver/vehicle updates, new quotes and visual preferences.
import { useState, useSyncExternalStore } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PolicyRecord, PolicySource } from '@/types/policy';
import type { Driver, Vehicle } from '@/types/quote';
import type { ProductKey } from '@/products/types';
import { useQuote } from '@/context/useQuote';
import { runWithSpinner } from '@/services/processing';
import { applyChange, previewChange } from '@/services/endorsement';
import { setVisualPrefs, visualPrefsStore, type TextSize } from '@/services/visualPrefs';
import { ANNUAL_MILES, INCIDENT_CODES, MARITAL_STATUSES, PRIMARY_USES } from '@/data/options';
import { productLabel } from '@/products/configs';
import { formatCurrency } from '@/utils/masks';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';
import { InlineError, SelectControl, TextControl } from '@/components/wizard/primitives';
import { LOYALTY_LEVELS, driveSense, paperlessOf } from '@/servicing/account/accountModel';

type Close = (message?: string) => void;
const hid = () => `his-${Math.random().toString(36).slice(2, 10)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const table = 'w-full border-collapse text-[13px]';
const th = 'w-[42%] border border-[#d7e0e6] bg-[#f6f9fb] px-3 py-[6px] text-left font-medium';
const td = 'border border-[#d7e0e6] px-3 py-[6px]';

function Rows({ rows }: { rows: [string, string][] }) {
  return <table className={table}><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row" className={th}>{label}</th><td className={td}>{value}</td></tr>)}</tbody></table>;
}

function Done({ onClose }: { onClose: () => void }) {
  return <button type="button" className={modalButton.blue} onClick={onClose}>Close</button>;
}

export function DeliveryModal({ policy, onClose }: { policy: PolicyRecord; onClose: Close }) {
  const { servicePolicy } = useQuote();
  const current = paperlessOf(policy);
  const [enrolled, setEnrolled] = useState(current.enrolled);
  const [error, setError] = useState('');
  const submit = () => {
    if (enrolled === current.enrolled) { onClose(); return; }
    if (enrolled && !policy.insured.email) { setError('Add an email address with Update Email before enrolling in paperless.'); return; }
    runWithSpinner('Updating delivery method...', () => {
      const result = servicePolicy(policy.id, (record, day) => ({ ...record, paperless: { enrolled, changedOn: day, reason: enrolled ? 'Enrolled' : 'Customer request' }, history: [...record.history, { id: hid(), date: day, event: 'Document delivery method changed', detail: enrolled ? `Paperless: documents and bills by email to ${record.insured.email}.` : 'Documents and bills by U.S. mail.' }] }));
      if (result) { setError(result); return; }
      onClose(enrolled ? 'Paperless enrollment confirmed.' : 'Delivery changed to U.S. mail.');
    });
  };
  const option = (value: boolean, title: string, text: string) => <label className="flex items-start gap-3 rounded-[3px] border border-[#cfdbe3] px-3 py-2 text-[14px]"><input type="radio" name="delivery" checked={enrolled === value} onChange={() => setEnrolled(value)} className="mt-[3px] h-[18px] w-[18px] accent-[#003865]" /><span><b>{title}</b><span className="block text-[13px] text-[#5c6670]">{text}</span></span></label>;
  return <Modal title="Change Document Delivery Method" width={620} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.blue} onClick={submit}>Save</button></>}>
    <div className="space-y-2">
      {option(true, 'Online access (paperless)', `Documents and bills by email${policy.insured.email ? ` to ${policy.insured.email}` : ''}, excluding those required by law to be sent through U.S. mail.`)}
      {option(false, 'U.S. mail', 'Documents and bills are printed and mailed to the mailing address.')}
    </div>
    <InlineError message={error} />
  </Modal>;
}

/** Training rule: $50 is credited to the deductible every six claim-free months, up to $500. */
export function DeductibleSavingsModal({ policy, onClose }: { policy: PolicyRecord; onClose: Close }) {
  const { state, servicePolicy, engine } = useQuote();
  const enrolled = policy.deductibleSavings;
  const saved = enrolled ? Math.min(500, Math.floor(engine.dayDiff(enrolled.enrolledOn, state.simDate) / 182) * 50) : 0;
  const enroll = () => runWithSpinner('Enrolling...', () => {
    servicePolicy(policy.id, (record, day) => ({ ...record, deductibleSavings: { enrolledOn: day }, history: [...record.history, { id: hid(), date: day, event: 'Deductible Savings Bank enrolled', detail: 'Customer enrolled; $50 is credited toward the deductible for every six claim-free months.' }] }));
    onClose('Enrolled in Deductible Savings Bank.');
  });
  return <Modal title="Deductible Savings Bank" width={600} onClose={() => onClose()} footer={enrolled || policy.status !== 'Active' ? <Done onClose={() => onClose()} /> : <><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Not Now</button><button type="button" className={modalButton.blue} onClick={enroll}>Enroll Now</button></>}>
    <p className="text-[14px] leading-[20px]">Drive claim-free and earn money toward the comprehensive and collision deductibles: <b>$50 for every six months without a claim</b>, up to $500. A claim resets the bank to $0.</p>
    {enrolled ? <p className="mt-3 flex items-center gap-2 text-[14px] text-[#0b5d3f]"><CheckCircle2 size={18} />Enrolled {enrolled.enrolledOn}. Current savings: <b>{formatCurrency(saved)}</b></p> : policy.status !== 'Active' && <p className="mt-3 text-[13px] text-[#c8102e]">Only active policies can enroll.</p>}
    <p className="mt-3 text-[12px] text-[#5c6670]">Training program rules for practice only.</p>
  </Modal>;
}

/** A stable pseudo-random number per policy, so the driving summary doesn't change between visits. */
function seeded(text: string, index: number): number {
  let hash = 2166136261;
  for (const char of `${text}:${index}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}

export function DriveSenseModal({ policy, onClose }: { policy: PolicyRecord; onClose: Close }) {
  const value = driveSense(policy);
  const enrolled = !!value && !/not|do not/i.test(value);
  const r = (index: number) => seeded(policy.policyNumber, index);
  const rows: [string, string][] = enrolled ? [
    ['Enrollment', value], ['Monitoring status', 'Active, mobile app'], ['Trips recorded', String(80 + Math.round(r(1) * 140))], ['Miles driven', (900 + Math.round(r(2) * 3100)).toLocaleString('en-US')],
    ['Hard brakes per 100 miles', (r(3) * 2.2).toFixed(1)], ['Phone use while driving', `${Math.round(r(4) * 9)} minutes`], ['Late-night driving (12-4 a.m.)', `${(r(5) * 4).toFixed(1)}% of miles`], ['Estimated discount at renewal', `${5 + Math.round(r(6) * 20)}%`],
  ] : [];
  return <Modal title="DriveSense Summary" width={600} onClose={() => onClose()} footer={<Done onClose={() => onClose()} />}>
    {enrolled ? <><Rows rows={rows} /><p className="mt-3 text-[12px] text-[#5c6670]">Simulated driving data for training. DriveSense is the LAVA Training usage-based program.</p></> : <p className="text-[14px] leading-[20px]">This policy is not enrolled in DriveSense. The customer can enroll with <b>Update Coverages</b> (Change coverages › DriveSense) and save based on how they drive.</p>}
  </Modal>;
}

export function LoyaltyModal({ policy, level, onClose }: { policy: PolicyRecord; level: string; onClose: Close }) {
  return <Modal title="Discounts and Rewards" width={640} onClose={() => onClose()} footer={<Done onClose={() => onClose()} />}>
    <p className="mb-3 text-[14px]">Loyalty level: <b>{level}</b></p>
    <table className={table}><thead><tr><th className={th}>Level</th><th className={`${td} text-left font-medium`}>Customer for</th><th className={`${td} text-left font-medium`}>Benefit</th></tr></thead><tbody>{LOYALTY_LEVELS.map((entry) => <tr key={entry.name} className={entry.name === level ? 'bg-[#fff8e5] font-bold' : ''}><td className={td}>{entry.name}</td><td className={td}>{entry.years ? `${entry.years}+ years` : 'New'}</td><td className={td}>{entry.perk}</td></tr>)}</tbody></table>
    <p className="mt-3 text-[14px]"><b>Discounts on this policy:</b> {policy.discounts.length ? policy.discounts.join(', ') : 'None'}</p>
  </Modal>;
}

export function DrivingRecordModal({ policy, driver, onClose }: { policy: PolicyRecord; driver: Driver; onClose: Close }) {
  const incidents = driver.incidents.filter((entry) => entry.code);
  const label = (code: string) => INCIDENT_CODES.find((entry) => entry.value === code)?.label ?? code;
  return <Modal title="Driving Record and Filings" width={640} onClose={() => onClose()} footer={<Done onClose={() => onClose()} />}>
    <p className="mb-3 text-[14px] font-bold">{[driver.firstName, driver.lastName].join(' ')}</p>
    <Rows rows={[['License status', driver.licenseStatus || 'Valid'], ['License state', driver.licenseState || policy.state], ['License number', driver.licenseNumber ? `••••${driver.licenseNumber.slice(-4)}` : 'Not on file'], ['State filing (SR-22/FR-44)', driver.stateFiling === 'Yes' ? 'Yes, filing on record' : 'None'], ['Driver status', driver.driverStatus === 'Excluded' ? 'Excluded' : 'Rated']]} />
    <h3 className="mb-1 mt-4 text-[14px] font-bold">Accidents and violations</h3>
    {incidents.length ? <table className={table}><tbody>{incidents.map((entry) => <tr key={entry.id}><td className={td}>{entry.date}</td><td className={td}>{label(entry.code)}</td></tr>)}</tbody></table> : <p className="text-[14px] text-[#0b5d3f]">None reported. The motor vehicle record is clear.</p>}
  </Modal>;
}

type Field = { key: string; label: string; options?: readonly string[]; digits?: number };

/** A one-screen endorsement: edit a few fields, preview the premium change, submit. */
function QuickChange({ policy, title, fields, initial, build, onClose }: { policy: PolicyRecord; title: string; fields: Field[]; initial: Record<string, string>; build: (values: Record<string, string>) => { draft: PolicySource; changes: string[] }; onClose: Close }) {
  const { state, servicePolicy } = useQuote();
  const [values, setValues] = useState(initial);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const { draft, changes } = build(values);
  const preview = changes.length ? previewChange(policy, draft, state.simDate) : null;
  const submit = () => {
    const invalid = fields.find((field) => field.digits && !new RegExp(`^\\d{${field.digits}}$`).test(values[field.key] ?? ''));
    if (invalid) { setError(`${invalid.label} must be ${invalid.digits} digits.`); return; }
    if (!changes.length) { setError('Nothing has changed yet.'); return; }
    if (!approved) { setError('Confirm the customer requested this change and agrees to the premium change.'); return; }
    runWithSpinner('Submitting policy change...', () => {
      const result = servicePolicy(policy.id, (record, day) => applyChange(record, { draft, effectiveDate: day, changes, vehiclesChanged: false, lienholders: record.lienholders, newLienholders: [] }, day));
      if (result) { setError(result); return; }
      onClose(`Policy change processed effective ${state.simDate}. Amended declarations issued.`);
    }, 1000);
  };
  return <Modal title={title} width={640} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.primary} onClick={submit}>Submit Change</button></>}>
    <div className="grid grid-cols-2 gap-3">{fields.map((field) => <label key={field.key} className="block text-[13px]"><span className="mb-1 block font-medium">{field.label}</span>{field.options ? <SelectControl value={values[field.key] ?? ''} options={field.options} onChange={(value) => setValues({ ...values, [field.key]: value })} /> : <TextControl value={values[field.key] ?? ''} mask={field.digits ? 'number' : undefined} onChange={(value) => setValues({ ...values, [field.key]: value })} />}</label>)}</div>
    {preview && <p className="mt-3 rounded-[3px] border border-[#cfdbe3] bg-[#f6f9fb] px-3 py-2 text-[13px]">Effective today ({state.simDate}). {preview.prorated === 0 ? 'No premium change.' : `${preview.prorated > 0 ? 'Additional' : 'Return'} premium for the rest of the term: ${formatCurrency(Math.abs(preview.prorated))}.`}</p>}
    <label className="mt-3 flex items-start gap-2 text-[13px]"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} className="mt-px h-[18px] w-[18px] accent-[#003865]" />The customer requested this change and agrees to the premium change.</label>
    <InlineError message={error} />
  </Modal>;
}

export function DriverUpdateModal({ policy, driver, onClose }: { policy: PolicyRecord; driver: Driver; onClose: Close }) {
  const name = [driver.firstName, driver.lastName].join(' ');
  const yesNo = ['Yes', 'No'];
  const initial = { maritalStatus: driver.maritalStatus, goodStudent: driver.goodStudent || 'No', distantStudent: driver.distantStudent || 'No' };
  const labels: Record<string, string> = { maritalStatus: 'marital status', goodStudent: 'good student', distantStudent: 'distant student' };
  const build = (values: Record<string, string>) => {
    const draft = clone(policy.source);
    const changes: string[] = [];
    if (draft.kind === 'personal') {
      const target = draft.quote.drivers.find((entry) => entry.id === driver.id);
      for (const key of Object.keys(initial) as (keyof typeof initial)[]) if (target && values[key] !== initial[key]) { (target as unknown as Record<string, string>)[key] = values[key]; changes.push(`Updated ${name}: ${labels[key]} ${initial[key] || 'blank'} to ${values[key]}`); }
    }
    return { draft, changes };
  };
  return <QuickChange policy={policy} title={`Update Driver: ${name}`} initial={initial} build={build} onClose={onClose} fields={[{ key: 'maritalStatus', label: 'Marital status', options: MARITAL_STATUSES }, { key: 'goodStudent', label: 'Good student (B average)', options: yesNo }, { key: 'distantStudent', label: 'Student 100+ miles away without a car', options: yesNo }]} />;
}

export function VehicleUpdateModal({ policy, vehicle, onClose }: { policy: PolicyRecord; vehicle: Vehicle; onClose: Close }) {
  const name = [vehicle.year, vehicle.make, vehicle.model].join(' ');
  const initial = { primaryUse: vehicle.primaryUse, annualMiles: vehicle.annualMiles, garagingZip: vehicle.garagingZip };
  const labels: Record<string, string> = { primaryUse: 'primary use', annualMiles: 'annual miles', garagingZip: 'garaging ZIP' };
  const build = (values: Record<string, string>) => {
    const draft = clone(policy.source);
    const changes: string[] = [];
    if (draft.kind === 'personal') {
      const target = draft.quote.vehicles.find((entry) => entry.id === vehicle.id);
      for (const key of Object.keys(initial) as (keyof typeof initial)[]) if (target && values[key] !== initial[key]) { target[key] = values[key]; changes.push(`Updated ${name}: ${labels[key]} ${initial[key] || 'blank'} to ${values[key]}`); }
    }
    return { draft, changes };
  };
  return <QuickChange policy={policy} title={`Update Vehicle: ${name}`} initial={initial} build={build} onClose={onClose} fields={[{ key: 'primaryUse', label: 'Primary use', options: PRIMARY_USES }, { key: 'annualMiles', label: 'Annual miles', options: ANNUAL_MILES }, { key: 'garagingZip', label: 'Garaging ZIP code', digits: 5 }]} />;
}

const PERSONAL: ProductKey[] = ['auto', 'motorcycle', 'boat', 'motorhome', 'trailer', 'snowmobile', 'renters'];

export function NewQuotesModal({ policy, owned, onClose }: { policy: PolicyRecord; owned: string[]; onClose: Close }) {
  const { startQuoteFor } = useQuote();
  const [picked, setPicked] = useState<ProductKey[]>([]);
  const [error, setError] = useState('');
  const personal = policy.source.kind === 'personal';
  const start = () => {
    if (!picked.length) { setError('Select at least one product to quote.'); return; }
    runWithSpinner('Creating quote...', () => startQuoteFor(policy.id, picked));
  };
  return <Modal title="New Policy Quotes" width={600} onClose={() => onClose()} footer={personal ? <><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.blue} onClick={start}>Start Quote</button></> : <Done onClose={() => onClose()} />}>
    {personal ? <>
      <p className="mb-3 text-[14px]">Quote another product for <b>{policy.insured.name}</b>. The customer's name, address, drivers and vehicles are filled in from policy #{policy.policyNumber}.</p>
      <div className="grid grid-cols-2 gap-2">{PERSONAL.map((key) => <label key={key} className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={picked.includes(key)} onChange={(event) => setPicked(event.target.checked ? [...picked, key] : picked.filter((entry) => entry !== key))} className="h-[18px] w-[18px] accent-[#003865]" />{productLabel(key)}{owned.includes(key) && <span className="text-[11px] font-bold text-[#0b5d3f]">IN FORCE</span>}</label>)}</div>
      <InlineError message={error} />
    </> : <p className="text-[14px]">Commercial accounts are quoted from <b>New Business › New Quote</b> on the dashboard.</p>}
  </Modal>;
}

export function VisualPreferencesModal({ onClose }: { onClose: Close }) {
  const prefs = useSyncExternalStore(visualPrefsStore.subscribe, visualPrefsStore.get);
  const [textSize, setTextSize] = useState<TextSize>(prefs.textSize);
  const [reduceMotion, setReduceMotion] = useState(prefs.reduceMotion);
  const save = () => { setVisualPrefs({ textSize, reduceMotion }); onClose(); };
  return <Modal title="Visual Preferences" width={520} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.blue} onClick={save}>Save</button></>}>
    <fieldset className="text-[14px]"><legend className="mb-2 font-bold">Text size</legend><div className="flex gap-5">{(['Standard', 'Large', 'Larger'] as const).map((size) => <label key={size} className="flex items-center gap-2"><input type="radio" name="text-size" checked={textSize === size} onChange={() => setTextSize(size)} className="h-[18px] w-[18px] accent-[#003865]" />{size}</label>)}</div></fieldset>
    <label className="mt-4 flex items-center gap-2 text-[14px]"><input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} className="h-[18px] w-[18px] accent-[#003865]" />Reduce motion (no animated loading car)</label>
    <p className="mt-3 text-[12px] text-[#5c6670]">Saved in this browser only.</p>
  </Modal>;
}

