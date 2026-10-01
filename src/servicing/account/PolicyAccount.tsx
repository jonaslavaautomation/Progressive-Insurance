// Manage Policies > Policy and Coverages: the account page a policy or customer search opens.
// At a Glance, billing, documents, people, vehicles and itemized coverages, with every link
// opening the matching servicing workflow.
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Car, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Printer } from 'lucide-react';
import type { UnitSnapshot } from '@/types/policy';
import type { Driver } from '@/types/quote';
import { useQuote } from '@/context/useQuote';
import { visualPrefsStore, TEXT_ZOOM } from '@/services/visualPrefs';
import { productLabel, configFor } from '@/products/configs';
import { formatCurrency } from '@/utils/masks';
import { LegalLink } from '@/components/LegalLink';
import { PaymentModal } from '@/servicing/PolicyView';
import { ChangePolicyModal } from '@/servicing/ChangePolicy';
import { availableTypes, type ChangeType } from '@/servicing/changeTypes';
import { TrainingClock } from '@/servicing/ServiceChrome';
import { hasIdCards } from '@/servicing/portal/portalUtils';
import { AccountDrawer } from '@/servicing/account/AccountDrawer';
import { DeductibleSavingsModal, DeliveryModal, DriveSenseModal, DriverUpdateModal, DrivingRecordModal, LoyaltyModal, NewQuotesModal, VehicleUpdateModal, VisualPreferencesModal } from '@/servicing/account/AccountModals';
import { amountDueText, autoCoverageRows, billingStatus, coverageHelp, customerSinceDate, driveSense, driversOf, household, importantMessages, lastPayment, longDate, loyaltyLevel, paperlessOf, paymentMethodLabel, rowsTotal, unitCoverageRows, type CoverageRow } from '@/servicing/account/accountModel';

const focus = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';
const card = 'rounded-[4px] border border-[#d0d7de] bg-white';
const label = 'text-[13px] font-bold text-[#1f2a33]';
const value = 'mt-[2px] text-[13px] text-[#3d4b55]';
const sectionTitle = 'text-[19px] font-medium text-[#5c6670]';
const bigButton = `flex h-[46px] min-w-[208px] items-center justify-center gap-[8px] rounded-[3px] border border-[#0073cf] bg-white px-[20px] text-[13px] font-bold text-[#0073cf] hover:bg-[#f2f8fd] ${focus}`;

type Dialog =
  | { kind: 'change'; type: ChangeType }
  | { kind: 'pay' | 'delivery' | 'savings' | 'drivesense' | 'loyalty' | 'quotes' | 'prefs' }
  | { kind: 'record' | 'driver'; driver: Driver }
  | { kind: 'vehicle'; index: number };

function ArrowLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`mt-[8px] inline-flex items-center gap-[3px] text-[12.5px] font-medium text-[#0073cf] hover:text-[#0056b3] hover:underline ${focus}`}>{children}<ChevronRight size={14} strokeWidth={2.4} /></button>;
}

function TextLink({ children, onClick, strong = false }: { children: ReactNode; onClick: () => void; strong?: boolean }) {
  return <button type="button" onClick={onClick} className={`text-[12.5px] ${strong ? 'font-bold' : ''} text-[#0073cf] hover:text-[#0056b3] hover:underline ${focus}`}>{children}</button>;
}

function Item({ title, children }: { title: string; children: ReactNode }) {
  return <div><div className={label}>{title}</div><div className={value}>{children}</div></div>;
}

function ShowMore({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <button type="button" aria-expanded={open} onClick={onClick} className={`mt-[18px] inline-flex items-center gap-[6px] text-[12.5px] font-bold text-[#0073cf] hover:underline ${focus}`}>{open ? 'Show less' : 'Show more'}{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>;
}

function Details({ rows }: { rows: [string, string][] }) {
  return <dl className="mt-[10px] grid grid-cols-[auto_1fr] gap-x-[14px] gap-y-[4px] border-t border-[#e5e9ec] pt-[10px] text-[12px]">{rows.map(([term, detail]) => <div key={term} className="contents"><dt className="font-bold text-[#1f2a33]">{term}</dt><dd className="text-[#3d4b55]">{detail || '—'}</dd></div>)}</dl>;
}

/** "Gold loyalty level" badge: three stacked bars in the level's color. */
function LoyaltyBadge({ level, onClick }: { level: string; onClick: () => void }) {
  const tone: Record<string, [string, string]> = { Bronze: ['#c9874b', '#8a5626'], Silver: ['#c5ccd3', '#7d8790'], Gold: ['#f2c94c', '#b8860b'], Platinum: ['#dfe7ee', '#6f8696'] };
  const [fill, stroke] = tone[level] ?? tone.Gold;
  return <div className="flex items-start gap-[10px]">
    <svg viewBox="0 0 44 30" className="h-[30px] w-[44px] shrink-0" aria-hidden>{[[2, 14], [22, 14], [12, 2]].map(([x, y]) => <path key={`${x}-${y}`} d={`M${x + 3} ${y}h14l3 12H${x}z`} fill={fill} stroke={stroke} strokeWidth={1.2} strokeLinejoin="round" />)}</svg>
    <div className="text-[12.5px] leading-[17px]"><div className="font-medium" style={{ color: stroke }}>{level} loyalty level</div><button type="button" onClick={onClick} className={`text-[#0073cf] hover:underline ${focus}`}>Discounts and Rewards</button></div>
  </div>;
}

function HelpLink({ row }: { row: CoverageRow }) {
  const [open, setOpen] = useState(false);
  return <span className="relative ml-[8px] inline-block">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`text-[11.5px] font-normal text-[#0073cf] underline underline-offset-2 hover:text-[#0056b3] ${focus}`}>Help</button>
    {open && <span role="tooltip" className="absolute left-0 top-[20px] z-20 block w-[300px] rounded-[4px] border border-[#d0d7de] bg-white p-[12px] text-[12px] font-normal leading-[17px] text-[#3d4b55] shadow-lg">
      <b className="mb-[4px] block text-[#1f2a33]">{row.label}</b>{row.help}
      <button type="button" onClick={() => setOpen(false)} className={`mt-[6px] block text-[11.5px] font-bold text-[#0073cf] ${focus}`}>Close</button>
    </span>}
  </span>;
}

function CoverageTable({ unit, rows, id }: { unit: UnitSnapshot; rows: CoverageRow[]; id: string }) {
  return <section id={id} className={`${card} mb-[24px] scroll-mt-[20px] overflow-visible`} aria-label={`${unit.label} coverages`}>
    <div className="flex items-center gap-[14px] rounded-t-[4px] bg-[#eef5fb] px-[22px] py-[14px]"><Car size={30} strokeWidth={1.5} className="shrink-0 fill-[#8fd6f2] text-[#2f4a66]" /><div><div className="text-[13px] font-bold uppercase text-[#1f2a33]">{unit.label}</div>{unit.idNumber && <div className="text-[12px] text-[#5c6670]">{unit.idNumber}</div>}</div></div>
    <div className="h-[4px] bg-[#0073cf]" />
    <div className="px-[22px] pb-[8px]">
      {rows.map((row) => <div key={row.label} className="flex items-start justify-between gap-[16px] py-[12px]"><div><div className="text-[13px] font-bold text-[#1f2a33]">{row.label}<HelpLink row={row} /></div><div className="mt-[3px] text-[12.5px] text-[#5c6670]">{row.value}</div></div><div className="shrink-0 pt-[2px] text-[13px] tabular-nums text-[#3d4b55]">{formatCurrency(row.premium)}</div></div>)}
      <div className="mt-[6px] flex justify-between border-t border-[#e5e9ec] py-[16px] text-[13px] font-bold text-[#1f2a33]"><span>Total vehicle Premium</span><span className="tabular-nums font-normal text-[#3d4b55]">{formatCurrency(rowsTotal(rows))}</span></div>
    </div>
  </section>;
}

function PersonCard({ name, role, dob, driver, active, onRecord, onUpdate, onRemove }: { name: string; role: string; dob: string; driver?: Driver; active: boolean; onRecord?: () => void; onUpdate?: () => void; onRemove?: () => void }) {
  const [more, setMore] = useState(false);
  return <div className={`${card} p-[22px]`}>
    <div className="text-[15px] font-bold text-[#2f4a66]">{name}</div>
    <div className="text-[12px] text-[#5c6670]">{role}</div>
    <div className="mt-[14px]"><Item title="Date of birth">{longDate(dob)}</Item></div>
    {onRecord && <div className="mt-[10px]"><TextLink onClick={onRecord}>Driving Record and Filings</TextLink></div>}
    {active && (onUpdate || onRemove) && <div className="mt-[16px] flex gap-[22px]">{onUpdate && <TextLink strong onClick={onUpdate}>Update</TextLink>}{onRemove && <TextLink strong onClick={onRemove}>Remove</TextLink>}</div>}
    <div><ShowMore open={more} onClick={() => setMore(!more)} /></div>
    {more && <Details rows={driver ? [['Relationship', driver.relationship === 'Insured' ? 'Named insured' : driver.relationship], ['Marital status', driver.maritalStatus], ['Gender', driver.gender], ['Driver status', driver.driverStatus === 'Excluded' ? 'Excluded' : 'Rated'], ['License state', driver.licenseState], ['License number', driver.licenseNumber ? `••••${driver.licenseNumber.slice(-4)}` : ''], ['Good student', driver.goodStudent || 'No']] : [['Relationship', 'Named insured']]} />}
  </div>;
}

function UnitCard({ unit, details, actions, coveragesLabel, onCoverages }: { unit: UnitSnapshot; details: [string, string][]; actions: [string, () => void][]; coveragesLabel: string; onCoverages: () => void }) {
  const [more, setMore] = useState(false);
  return <div className={`${card} p-[22px]`}>
    <div className="text-[14px] font-bold uppercase text-[#2f4a66]">{unit.label}</div>
    {unit.idNumber && <div className="text-[12px] text-[#5c6670]">{unit.idNumber}</div>}
    {actions.length > 0 && <div className="mt-[16px] flex gap-[22px]">{actions.map(([text, onClick]) => <TextLink key={text} strong onClick={onClick}>{text}</TextLink>)}</div>}
    <div className="mt-[8px]"><TextLink onClick={onCoverages}>Go to {coveragesLabel}</TextLink></div>
    <div><ShowMore open={more} onClick={() => setMore(!more)} /></div>
    {more && <Details rows={details} />}
  </div>;
}

export function PolicyAccount() {
  const { state, openPolicy, openProof, lastConfirmation } = useQuote();
  const prefs = useSyncExternalStore(visualPrefsStore.subscribe, visualPrefsStore.get);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [message, setMessage] = useState('');
  const policy = state.policies.find((entry) => entry.id === state.ui.policyId);
  if (!policy) return <div className="p-10 text-[14px]">Policy not found.</div>;

  const day = state.simDate;
  const active = policy.status === 'Active';
  const types = active ? availableTypes(policy) : [];
  const can = (type: ChangeType) => types.includes(type);
  const change = (type: ChangeType) => setDialog({ kind: 'change', type });
  const close = (text?: string) => { setDialog(null); if (text) setMessage(`${text} Confirmation #${lastConfirmation()}.`); };
  const isAuto = policy.product === 'auto';
  const config = configFor(policy.product);
  const vehicles = policy.source.kind === 'personal' ? policy.source.quote.vehicles : [];
  const drivers = driversOf(policy).filter((driver) => isAuto || policy.drivers.includes([driver.firstName, driver.lastName].join(' ')) || policy.product === 'commercialAuto');
  const messages = importantMessages(policy, day);
  const since = customerSinceDate(state.policies, policy);
  const loyalty = loyaltyLevel(since, day);
  const paperless = paperlessOf(policy);
  const paid = lastPayment(policy);
  const sense = driveSense(policy);
  const owned = household(state.policies, policy).filter((entry) => entry.status === 'Active').map((entry) => entry.product);
  const unitRows = policy.units.map((unit, index) => (isAuto ? autoCoverageRows(policy, unit, index) : unitCoverageRows(unit)));
  const unitsTotal = Math.round(unitRows.reduce((sum, rows) => sum + rowsTotal(rows), 0) * 100) / 100;
  const policyLevel = isAuto ? [] : policy.policyCoverages.map((line) => ({ label: line.label, value: line.value, premium: line.premium ?? 0, help: coverageHelp(line.label) }));
  const listedTotal = Math.round((unitsTotal + rowsTotal(policyLevel)) * 100) / 100;
  const adjustment = Math.round((policy.termPremium - listedTotal) * 100) / 100;
  const unitWord = isAuto ? 'Vehicles' : config?.unitPlural ?? 'Units';
  const coveragesTitle = isAuto ? 'Vehicle Coverages' : `${config?.unitLabel ?? 'Unit'} Coverages`;
  const unitSingular = isAuto ? 'vehicle' : (config?.unitLabel ?? 'unit').toLowerCase();
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: prefs.reduceMotion ? 'auto' : 'smooth', block: 'start' });

  return <div className="account-page flex h-screen bg-white text-[#1f2a33]">
    <AccountDrawer policy={policy} open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} onNewQuotes={() => setDialog({ kind: 'quotes' })} onPreferences={() => setDialog({ kind: 'prefs' })} />
    <main className="account-main min-w-0 flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-[900px] px-[32px] pb-[40px] pt-[22px]" style={{ zoom: TEXT_ZOOM[prefs.textSize] }}>
        <TrainingClock />
        <header className="text-center">
          <h1 className="text-[30px] font-bold tracking-[-.4px] text-[#2f4a66]">Policy and Coverages</h1>
          <p className="mt-[2px] text-[15px] text-[#5c6670]">{productLabel(policy.product)} {policy.policyNumber}</p>
        </header>
        <div className="mt-[26px] flex items-center justify-between">
          <h2 className={sectionTitle}>At a Glance</h2>
          <button type="button" onClick={() => window.print()} className={`flex items-center gap-[6px] text-[12.5px] font-medium text-[#0073cf] hover:underline ${focus}`}><Printer size={16} />Print this page</button>
        </div>
        {message && <div role="status" className="mt-[14px] flex items-start justify-between gap-3 rounded-[4px] border border-[#0f7a52] bg-[#e6f4ef] px-[16px] py-[10px] text-[13.5px] text-[#0b5d3f]"><span className="flex gap-2"><CheckCircle2 size={18} className="mt-px shrink-0" />{message}</span><button type="button" onClick={() => setMessage('')} className="text-[12.5px] underline">Dismiss</button></div>}
        {messages.length > 0 && <section aria-label="Important messages" className="mt-[14px] rounded-[4px] border border-[#f3c6cd] bg-[#fdf0f2] px-[26px] py-[20px]">
          <h3 className="text-[19px] font-bold text-[#1f2a33]">Important Messages</h3>
          <ul className="mt-[12px] space-y-[8px]">{messages.map((text) => <li key={text} className="flex items-start gap-[10px] text-[13px] leading-[19px] text-[#9e0012]"><span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-[#c8102e]" aria-hidden />{text}</li>)}</ul>
        </section>}

        <section aria-label="Policy at a glance" className={`${card} mt-[22px] px-[30px] pb-[30px] pt-[20px]`}>
          <div className="flex justify-end"><LoyaltyBadge level={loyalty.name} onClick={() => setDialog({ kind: 'loyalty' })} /></div>
          <div className="mt-[4px] grid grid-cols-3 gap-x-[30px]">
            <div className="space-y-[22px]">
              <div><Item title="Policy">{productLabel(policy.product)} {policy.policyNumber}</Item><ArrowLink onClick={() => openPolicy(policy.id, 'history')}>Policy Activity</ArrowLink></div>
              <div><Item title="Policy period">{longDate(policy.effectiveDate)} – {longDate(policy.expirationDate)}</Item><ArrowLink onClick={() => openProof(policy.id)}>{hasIdCards(policy) ? 'ID Cards' : 'Proof of Insurance'}</ArrowLink></div>
              <div><Item title="Total policy premium">{formatCurrency(policy.termPremium)}</Item><ArrowLink onClick={() => openPolicy(policy.id, 'billing')}>Billing and Payments</ArrowLink></div>
              <Item title="Valued customer since">{since}</Item>
              <Item title="Servicing agent">{state.agent.agencyName}</Item>
              <Item title="Agent code">{policy.agentCode}</Item>
              <Item title="Producer name">{policy.agentName}</Item>
            </div>
            <div>
              <div className={label}>Contact information</div>
              <div className={`${value} font-medium text-[#1f2a33]`}>{policy.insured.name}</div>
              <div className={value}>{policy.insured.email || 'No email on file'}</div>
              {can('contact') && <ArrowLink onClick={() => change('contact')}>Update Email</ArrowLink>}
              <div className={`${value} mt-[16px]`}>(Mobile) {policy.insured.phone || '—'}</div>
              {can('contact') && <ArrowLink onClick={() => change('contact')}>Update Phone Number</ArrowLink>}
              <div className={`${value} mt-[16px]`}>{policy.insured.street}<br />{policy.insured.cityStateZip}</div>
              {can('address') && <ArrowLink onClick={() => change('address')}>Update Address</ArrowLink>}
            </div>
            <div className="space-y-[22px]">
              <div><Item title="Paperless">{paperless.enrolled ? 'Enrolled' : 'Not enrolled'}</Item><p className="mt-[8px] text-[12.5px] leading-[17px] text-[#3d4b55]">{paperless.enrolled ? 'You receive bills and documents through email.' : 'Bills and documents are sent by U.S. mail.'}</p><ArrowLink onClick={() => setDialog({ kind: 'delivery' })}>Manage</ArrowLink></div>
              {isAuto && <div><Item title="Deductible Savings Bank">{policy.deductibleSavings ? `Enrolled ${policy.deductibleSavings.enrolledOn}` : 'Not enrolled'}</Item><p className="mt-[8px] text-[12.5px] leading-[17px] text-[#3d4b55]">Drive safely and save: Check if you qualify to earn money toward your deductible.</p><ArrowLink onClick={() => setDialog({ kind: 'savings' })}>{policy.deductibleSavings ? 'View savings' : 'Enroll now'}</ArrowLink></div>}
              {isAuto && <div><Item title="DriveSense">{sense && !/not|do not/i.test(sense) ? sense : 'Not enrolled'}</Item><p className="mt-[8px] text-[12.5px] leading-[17px] text-[#3d4b55]">Learn all about your progress and manage your enrollment.</p><ArrowLink onClick={() => setDialog({ kind: 'drivesense' })}>Review DriveSense Summary</ArrowLink></div>}
            </div>
          </div>
        </section>

        <section aria-label="Billing and payments" className={`${card} mt-[30px] px-[22px] py-[22px]`}>
          <h2 className="text-[15px] font-medium text-[#2f4a66]">Billing and Payments</h2>
          <div className="mt-[14px] grid grid-cols-[1fr_auto] gap-[24px]">
            <dl className="grid grid-cols-[150px_1fr] gap-y-[14px] text-[13px]">
              <dt className="font-bold">Billing status</dt><dd>{billingStatus(policy, day)}</dd>
              <dt className="font-bold">Bill plan</dt><dd><TextLink onClick={() => openPolicy(policy.id, 'billing')}><span className="uppercase underline">{policy.billPlanName}</span></TextLink></dd>
              <dt className="font-bold">Last amount paid{paid && <span className="block">{paid.date}</span>}</dt><dd>{paid ? formatCurrency(paid.amount) : 'No payments yet'}</dd>
              <dt className="font-bold">Payment method</dt><dd><TextLink onClick={() => openPolicy(policy.id, 'billing')}><span className="underline">{paymentMethodLabel(policy.paymentMethod)}</span></TextLink></dd>
              <dt className="font-bold">Electronic billing</dt><dd>{paperless.enrolled ? 'Enrolled' : 'Not enrolled'}</dd>
              <dt className="font-bold">CSDD</dt><dd>No</dd>
            </dl>
            <div className="w-[260px] text-[13px]">
              <p>{amountDueText(policy)}</p>
              {(active || policy.status === 'Pending Cancel') && <button type="button" onClick={() => setDialog({ kind: 'pay' })} className={`mt-[14px] h-[46px] w-[190px] rounded-[3px] bg-[#0073cf] text-[13px] font-bold text-white hover:bg-[#0056b3] ${focus}`}>Make a Payment</button>}
              {policy.status === 'Cancelled' && <button type="button" onClick={() => openPolicy(policy.id)} className={`mt-[14px] h-[46px] w-[190px] rounded-[3px] bg-[#0073cf] text-[13px] font-bold text-white hover:bg-[#0056b3] ${focus}`}>Reinstate or Rewrite</button>}
            </div>
          </div>
        </section>

        <h2 className={`${sectionTitle} mt-[30px]`}>Documents</h2>
        <div className="mt-[12px] grid grid-cols-2 gap-[20px]">
          <section className={`${card} px-[22px] py-[18px]`} aria-label="Document delivery method">
            <h3 className="text-[15px] font-medium text-[#2f4a66]">Document Delivery Method</h3>
            <TextLink onClick={() => setDialog({ kind: 'delivery' })}><span className="underline">Change document delivery method</span></TextLink>
            <dl className="mt-[12px] grid grid-cols-[120px_1fr] gap-y-[12px] text-[12.5px]">
              <dt className="font-bold">Delivery method:</dt><dd className="text-[#3d4b55]">{paperless.enrolled ? "Online access : Documents and bills (excluding those we're required by law to send through U.S. mail)" : 'U.S. mail : Documents and bills are mailed to the mailing address'}</dd>
              <dt className="font-bold">Latest change date:</dt><dd className="text-[#3d4b55]">{paperless.changedOn}</dd>
              <dt className="font-bold">Paperless status:</dt><dd className="text-[#3d4b55]">{paperless.enrolled ? 'Enrolled' : 'Not enrolled'}</dd>
              <dt className="font-bold">Reason:</dt><dd className="text-[#3d4b55]">{paperless.reason}</dd>
            </dl>
          </section>
          <section className={`${card} px-[22px] py-[18px]`} aria-label="New business documents">
            <h3 className="text-[15px] font-medium text-[#2f4a66]">New Business Documents</h3>
            <dl className="mt-[12px] grid grid-cols-[140px_1fr] gap-y-[12px] text-[12.5px]">
              <dt className="font-bold">Signature Preference:</dt><dd className="text-[#3d4b55]">Electronic</dd>
              <dt className="font-bold">Signature Status:</dt><dd className="text-[#3d4b55]">{policy.esign === 'Signed' ? 'Electronic forms complete' : 'Awaiting customer e-Signature'}</dd>
            </dl>
            <div className="mt-[12px]"><ArrowLink onClick={() => openPolicy(policy.id, 'documents')}>View all policy documents</ArrowLink></div>
          </section>
        </div>

        {(isAuto || drivers.length > 0) && can('addDriver') && <div className="mt-[26px] flex justify-end"><button type="button" onClick={() => change('addDriver')} className={bigButton}>Add a driver<ChevronRight size={16} strokeWidth={2.4} /></button></div>}
        <h2 className={`${sectionTitle} mt-[14px]`}>People</h2>
        <div className="mt-[12px] grid grid-cols-2 gap-[20px]">
          {drivers.length ? drivers.map((driver, index) => <PersonCard key={driver.id} name={[driver.firstName, driver.lastName].join(' ')} role={driver.driverStatus === 'Excluded' ? 'Excluded driver' : index === 0 || driver.relationship === 'Insured' ? 'Named insured' : 'Insured driver'} dob={driver.dob} driver={driver} active={active} onRecord={() => setDialog({ kind: 'record', driver })} onUpdate={isAuto ? () => setDialog({ kind: 'driver', driver }) : undefined} onRemove={can('removeDriver') && index > 0 ? () => change('removeDriver') : undefined} />)
            : <PersonCard name={policy.insured.name} role="Named insured" dob={policy.insured.dob} active={false} />}
        </div>

        <div className="mt-[30px] flex items-center justify-between">
          <h2 className={sectionTitle}>{unitWord}</h2>
          {can(isAuto ? 'addVehicle' : 'addUnit') && <button type="button" onClick={() => change(isAuto ? 'addVehicle' : 'addUnit')} className={bigButton}>Add a {unitSingular}<ChevronRight size={16} strokeWidth={2.4} /></button>}
        </div>
        <div className="mt-[12px] grid grid-cols-2 gap-[20px]">
          {policy.units.map((unit, index) => {
            const vehicle = isAuto ? vehicles[index] : undefined;
            const lien = policy.lienholders.filter((entry) => entry.unit === unit.label);
            const actions: [string, () => void][] = isAuto
              ? [...(active && vehicle ? [['Update', () => setDialog({ kind: 'vehicle', index })] as [string, () => void]] : []), ...(can('replaceVehicle') ? [['Replace', () => change('replaceVehicle')] as [string, () => void]] : []), ...(can('removeVehicle') && policy.units.length > 1 ? [['Remove', () => change('removeVehicle')] as [string, () => void]] : [])]
              : [...(can('coverages') ? [['Update', () => change('coverages')] as [string, () => void]] : []), ...(can('removeUnit') && policy.units.length > 1 ? [['Remove', () => change('removeUnit')] as [string, () => void]] : [])];
            const details: [string, string][] = vehicle
              ? [['VIN', vehicle.vin], ['Body style', vehicle.bodyStyle], ['Primary use', vehicle.primaryUse], ['Annual miles', vehicle.annualMiles], ['Garaging ZIP', vehicle.garagingZip], ['Lienholder', lien.map((entry) => `${entry.name} (${entry.kind})`).join(', ') || 'None']]
              : unit.details.map((detail) => { const [term, ...rest] = detail.split(':'); return rest.length ? [term.trim(), rest.join(':').trim()] as [string, string] : ['Detail', detail] as [string, string]; });
            return <UnitCard key={`${unit.label}-${index}`} unit={unit} details={details} actions={actions} coveragesLabel={coveragesTitle} onCoverages={() => scrollTo(`coverage-${index}`)} />;
          })}
        </div>

        <div className="mt-[30px] flex items-center justify-between">
          <h2 className={sectionTitle}>Coverages</h2>
          {can('coverages') && <button type="button" onClick={() => change('coverages')} className={bigButton}>Update Coverages<ChevronRight size={16} strokeWidth={2.4} /></button>}
        </div>
        <h3 className="mb-[12px] mt-[22px] text-[16px] font-medium text-[#5c6670]">{coveragesTitle}</h3>
        {policy.units.map((unit, index) => <CoverageTable key={`${unit.label}-${index}`} id={`coverage-${index}`} unit={unit} rows={unitRows[index]} />)}
        {policyLevel.length > 0 && <section className={`${card} mb-[24px] px-[22px] py-[8px]`} aria-label="Policy coverages"><h3 className="pt-[10px] text-[13px] font-bold uppercase">Policy Coverages</h3>{policyLevel.map((row) => <div key={row.label} className="flex justify-between gap-4 py-[10px]"><div><div className="text-[13px] font-bold">{row.label}<HelpLink row={row} /></div><div className="mt-[3px] text-[12.5px] text-[#5c6670]">{row.value}</div></div><div className="text-[13px] tabular-nums text-[#3d4b55]">{formatCurrency(row.premium)}</div></div>)}</section>}
        <p className="mt-[6px] text-center text-[17px] font-bold text-[#1f2a33]">Total policy premium: <span className="font-medium text-[#3d4b55]">{formatCurrency(policy.termPremium)}</span></p>
        {Math.abs(adjustment) >= 0.01 && <p className="mt-[4px] text-center text-[12px] text-[#5c6670]">Includes policy discounts, fees and bill plan adjustments of {adjustment < 0 ? '−' : '+'}{formatCurrency(Math.abs(adjustment))}.</p>}

        <footer className="mt-[60px] flex items-start justify-between gap-[20px] border-t border-[#e5e9ec] pt-[20px] text-[11.5px] text-[#3d4b55]">
          <div className="flex flex-col items-start gap-[10px]"><LegalLink label="CA Notice at Collection" className="hover:underline" /><LegalLink label="Do Not Sell or Share My Personal Information (CA Residents Only)" className="text-left hover:underline" /></div>
          <p className="max-w-[340px] text-right">Copyright {new Date().getFullYear()} LAVA Automation. LAVA Training is a training simulator and is not affiliated with Progressive Casualty Insurance Company.</p>
        </footer>
      </div>
    </main>

    {dialog?.kind === 'change' && <ChangePolicyModal policy={policy} initialType={dialog.type} onClose={close} />}
    {dialog?.kind === 'pay' && <PaymentModal policy={policy} onClose={close} />}
    {dialog?.kind === 'delivery' && <DeliveryModal policy={policy} onClose={close} />}
    {dialog?.kind === 'savings' && <DeductibleSavingsModal policy={policy} onClose={close} />}
    {dialog?.kind === 'drivesense' && <DriveSenseModal policy={policy} onClose={close} />}
    {dialog?.kind === 'loyalty' && <LoyaltyModal policy={policy} level={loyalty.name} onClose={close} />}
    {dialog?.kind === 'record' && <DrivingRecordModal policy={policy} driver={dialog.driver} onClose={close} />}
    {dialog?.kind === 'driver' && <DriverUpdateModal policy={policy} driver={dialog.driver} onClose={close} />}
    {dialog?.kind === 'vehicle' && vehicles[dialog.index] && <VehicleUpdateModal policy={policy} vehicle={vehicles[dialog.index]} onClose={close} />}
    {dialog?.kind === 'quotes' && <NewQuotesModal policy={policy} owned={owned} onClose={close} />}
    {dialog?.kind === 'prefs' && <VisualPreferencesModal onClose={close} />}
  </div>;
}

