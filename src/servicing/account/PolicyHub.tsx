// Policy hub: the menu that slides out beside the drawer (Agency Actions, Billing and Payments,
// Customer Information...) and the sub-panel each "›" item opens.
import { useState, type ReactNode } from 'react';
import { Banknote, ChevronRight, CircleCheck, ClipboardList, IdCard, KeyRound, NotebookPen, Settings, ShieldCheck, Star, UserRound, Users, X } from 'lucide-react';
import type { PolicyRecord } from '@/types/policy';
import { useQuote } from '@/context/useQuote';
import { nextInstallment } from '@/services/policyEngine';
import { paymentAccountOf, paymentMethodName } from '@/services/autopay';
import { productLabel } from '@/products/configs';
import { formatCurrency } from '@/utils/masks';
import { shortDate } from '@/servicing/portal/portalUtils';
import { billingStatus, driversOf, lastPayment, longDate, stateCode, statusText } from '@/servicing/account/accountModel';
import type { ChangeType } from '@/servicing/changeTypes';
import { customerKey } from '@/servicing/policyFilters';

const focus = 'outline-none focus-visible:shadow-[inset_0_0_0_2px_#0073cf]';
const hid = () => `his-${Math.random().toString(36).slice(2, 10)}`;

export type HubPanel = 'actions' | 'notes' | 'billing' | 'customer' | 'discounts' | 'drivers' | 'documents' | 'vehicles';

/** What the hub can ask the account page to do. */
export interface HubActions {
  /** Opens Change Policy, on the given change when one is named. */
  change: (type?: ChangeType) => void;
  can: (type: ChangeType) => boolean;
  pay: () => void;
  delivery: () => void;
  loyalty: () => void;
  newQuotes: () => void;
  updateCard: () => void;
  unenroll: () => void;
  scrollTo: (id: string) => void;
}

type Item = { label: string; onClick: () => void; hidden?: boolean; note?: string };

function Row({ icon, label, onClick, active, more }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean; more?: boolean }) {
  return <li><button type="button" onClick={onClick} aria-expanded={more ? active : undefined} className={`flex w-full items-center gap-[12px] border-b border-[#e5e9ec] px-[14px] py-[11px] text-left text-[12px] text-[#1f2a33] hover:bg-[#f2f5f8] ${active ? 'bg-[#eef4f9] font-bold' : ''} ${focus}`}>
    <span className="w-[20px] shrink-0 text-[#2f4a66]">{icon}</span><span className="flex-1">{label}</span>{more && <ChevronRight size={17} className="text-[#2f4a66]" />}
  </button></li>;
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <section aria-label={title} className="account-drawer flex w-[290px] shrink-0 flex-col overflow-y-auto border-r border-[#d0d7de] bg-white print:hidden">
    <div className="flex items-center justify-between px-[16px] pb-[8px] pt-[14px]"><h2 className="text-[14px] font-bold text-[#1f2a33]">{title}</h2><button type="button" onClick={onClose} aria-label={`Close ${title}`} className={`rounded p-[2px] text-[#1f2a33] hover:bg-[#f2f5f8] ${focus}`}><X size={20} /></button></div>
    {children}
  </section>;
}

function Links({ items }: { items: Item[] }) {
  return <ul className="border-t border-[#e5e9ec]">{items.filter((item) => !item.hidden).map((item) => <li key={item.label}><button type="button" onClick={item.onClick} className={`block w-full border-b border-[#e5e9ec] px-[16px] py-[11px] text-left text-[12px] text-[#1f2a33] hover:bg-[#f2f5f8] hover:text-[#0073cf] ${focus}`}>{item.label}{item.note && <span className="block text-[11px] text-[#5c6670]">{item.note}</span>}</button></li>)}</ul>;
}

function Summary({ rows }: { rows: [string, string][] }) {
  return <dl className="space-y-[10px] px-[16px] pb-[14px] text-[12px]">{rows.map(([term, detail]) => <div key={term}><dt className="font-bold text-[#1f2a33]">{term}</dt><dd className="text-[#3d4b55]">{detail}</dd></div>)}</dl>;
}

function NotesPanel({ policy, onClose }: { policy: PolicyRecord; onClose: () => void }) {
  const { servicePolicy } = useQuote();
  const [text, setText] = useState('');
  const notes = [...policy.history].reverse().filter((entry) => entry.event === 'Agency note');
  const save = () => {
    if (!text.trim()) return;
    servicePolicy(policy.id, (record, day) => ({ ...record, history: [...record.history, { id: hid(), date: day, event: 'Agency note', detail: text.trim() }] }));
    setText('');
  };
  return <Panel title="Agency Notes" onClose={onClose}>
    <div className="px-[16px] pb-[12px]">
      <label className="block text-[12px] font-bold text-[#1f2a33]" htmlFor="agency-note">Add a note</label>
      <textarea id="agency-note" value={text} onChange={(event) => setText(event.target.value.slice(0, 500))} rows={4} className="mt-[6px] w-full rounded-[3px] border border-[#8b98a3] p-[8px] text-[12px] outline-none focus:border-[#0073cf]" placeholder="Visible to the agency only. Fictitious details only." />
      <button type="button" onClick={save} disabled={!text.trim()} className={`mt-[8px] h-[32px] rounded-[3px] bg-[#0073cf] px-[14px] text-[12px] font-bold text-white hover:bg-[#0056b3] disabled:bg-[#7fb3e3] ${focus}`}>Save Note</button>
    </div>
    <ul className="border-t border-[#e5e9ec]">{notes.length ? notes.map((note) => <li key={note.id} className="border-b border-[#e5e9ec] px-[16px] py-[10px] text-[12px]"><div className="text-[11px] font-bold text-[#5c6670]">{note.date}</div><div className="whitespace-pre-wrap text-[#1f2a33]">{note.detail.replace(/ Confirmation #\d+\.$/, '')}</div></li>) : <li className="px-[16px] py-[10px] text-[12px] text-[#5c6670]">No notes on this policy yet.</li>}</ul>
  </Panel>;
}

export function PolicyHub({ policy, level, panel, onPanel, onClose, actions }: { policy: PolicyRecord; level: string; panel: HubPanel | null; onPanel: (panel: HubPanel | null) => void; onClose: () => void; actions: HubActions }) {
  const { state, openPolicy, openProof, openCustomer, openPage } = useQuote();
  const [term, setTerm] = useState('current');
  const toggle = (key: HubPanel) => onPanel(panel === key ? null : key);
  const go = (fn: () => void) => () => { onPanel(null); fn(); };
  const active = policy.status === 'Active';
  const auto = policy.product === 'auto';
  const account = paymentAccountOf(policy);
  const next = nextInstallment(policy);
  const paid = lastPayment(policy);
  const renewal = policy.renewal;

  const billingRows: [string, string][] = [
    ['Payment method', paymentMethodName(policy)],
    ['Last payment', paid ? `${formatCurrency(paid.amount)} on ${longDate(paid.date)}` : 'No payments yet'],
    ['Billing status', next && policy.status !== 'Cancelled' ? (policy.autopay && account ? `Payment scheduled ${formatCurrency(next.amount - next.paid)} on ${longDate(next.due)} from account ending in ${account.last4}` : `Payment of ${formatCurrency(next.amount - next.paid)} due ${longDate(next.due)}`) : billingStatus(policy, state.simDate)],
  ];
  const panels: Record<HubPanel, { title: string; rows?: [string, string][]; items: Item[] }> = {
    actions: { title: 'Agency Actions', items: [
      { label: 'Change Policy', onClick: go(() => actions.change()), hidden: !active },
      { label: 'Cancel or Reinstate Policy', onClick: go(() => openPolicy(policy.id)) },
      { label: 'Start a New Quote for this Customer', onClick: go(actions.newQuotes) },
      { label: 'Customer Summary', onClick: go(() => openCustomer(customerKey(policy))) },
      { label: 'Print this page', onClick: go(() => window.print()) },
    ] },
    notes: { title: 'Agency Notes', items: [] },
    billing: { title: 'Billing and Payments', rows: billingRows, items: [
      { label: 'Billing and Payment Summary', onClick: go(() => openPolicy(policy.id, 'billing')) },
      { label: 'Billing History', onClick: go(() => openPolicy(policy.id, 'billing')) },
      { label: 'Billing Statements', onClick: go(() => openPolicy(policy.id, 'documents')) },
      { label: 'Make a Payment', onClick: go(actions.pay), hidden: !(active || policy.status === 'Pending Cancel') },
      { label: 'Manage Scheduled Payments', onClick: go(() => openPolicy(policy.id, 'billing')) },
      { label: 'Paperless Preferences', onClick: go(actions.delivery) },
      { label: 'Payment Schedule', onClick: go(() => openPolicy(policy.id, 'billing')) },
      { label: 'Process Returned Check', onClick: go(() => openPolicy(policy.id, 'billing')), note: state.trainerMode ? 'Trainer tool on the Billing page' : undefined, hidden: !state.trainerMode },
      { label: 'Unenroll From Automatic Payments', onClick: go(actions.unenroll), hidden: !policy.autopay || !active },
      { label: policy.autopay || policy.billPlanId === 'PIF' ? 'Update Credit Card' : 'Enroll in Automatic Card Payments', onClick: go(actions.updateCard), hidden: !(active || policy.status === 'Pending Cancel') },
      { label: 'View Print Receipt', onClick: go(() => openPolicy(policy.id, 'documents')) },
    ] },
    customer: { title: 'Customer Information', rows: [['Named insured', policy.insured.name], ['Mailing address', `${policy.insured.street}, ${policy.insured.cityStateZip}`], ['Phone', policy.insured.phone || '—'], ['Email', policy.insured.email || '—']], items: [
      { label: 'Update Email or Phone Number', onClick: go(() => actions.change('contact')), hidden: !actions.can('contact') },
      { label: 'Update Address', onClick: go(() => actions.change('address')), hidden: !actions.can('address') },
      { label: 'Paperless Preferences', onClick: go(actions.delivery) },
      { label: 'Customer Summary', onClick: go(() => openCustomer(customerKey(policy))) },
    ] },
    discounts: { title: 'Discounts and Rewards', rows: [['Loyalty level', level], ['Discounts', policy.discounts.join(', ') || 'None']], items: [{ label: 'Loyalty Levels and Rewards', onClick: go(actions.loyalty) }] },
    drivers: { title: auto ? 'Drivers' : 'Operators', rows: driversOf(policy).map((driver) => [[driver.firstName, driver.lastName].join(' '), driver.driverStatus === 'Excluded' ? 'Excluded driver' : driver.relationship === 'Insured' ? 'Named insured' : driver.relationship || 'Insured driver']), items: [
      { label: 'View Drivers', onClick: go(() => actions.scrollTo('account-people')) },
      { label: 'Add a Driver', onClick: go(() => actions.change('addDriver')), hidden: !actions.can('addDriver') },
      { label: 'Remove or Exclude a Driver', onClick: go(() => actions.change('removeDriver')), hidden: !actions.can('removeDriver') },
    ] },
    documents: { title: 'ID Cards and Documents', items: [
      { label: 'ID Cards and Proof of Insurance', onClick: go(() => openProof(policy.id)) },
      { label: 'Declarations and Policy Packet', onClick: go(() => openPolicy(policy.id, 'documents')) },
      { label: 'All Policy Documents', onClick: go(() => openPolicy(policy.id, 'documents')) },
    ] },
    vehicles: { title: auto ? 'Vehicles' : 'Units', rows: policy.units.map((unit) => [unit.label, unit.idNumber || '—']), items: [
      { label: 'View Vehicle Coverages', onClick: go(() => actions.scrollTo('coverage-0')) },
      { label: auto ? 'Add a Vehicle' : 'Add a Unit', onClick: go(() => actions.change(auto ? 'addVehicle' : 'addUnit')), hidden: !actions.can(auto ? 'addVehicle' : 'addUnit') },
      { label: 'Replace a Vehicle', onClick: go(() => actions.change('replaceVehicle')), hidden: !actions.can('replaceVehicle') },
      { label: auto ? 'Remove a Vehicle' : 'Remove a Unit', onClick: go(() => actions.change(auto ? 'removeVehicle' : 'removeUnit')), hidden: !actions.can(auto ? 'removeVehicle' : 'removeUnit') },
      { label: 'Add or Remove a Lienholder', onClick: go(() => actions.change('lienholder')), hidden: !actions.can('lienholder') },
    ] },
  };
  const current = panel ? panels[panel] : null;

  return <>
    <nav aria-label="Policy menu" className="account-drawer flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-[#d0d7de] bg-white print:hidden">
      <div className="px-[14px] pb-[12px] pt-[14px]">
        <div className="flex items-start justify-between"><div className="text-[13px] font-bold text-[#1f2a33]">{productLabel(policy.product)} <span className="underline">{policy.policyNumber}</span></div><button type="button" onClick={onClose} aria-label="Close policy menu" className={`rounded p-[2px] text-[#1f2a33] hover:bg-[#f2f5f8] ${focus}`}><X size={20} /></button></div>
        <label className="sr-only" htmlFor="hub-term">Policy term</label>
        <select id="hub-term" value={term} onChange={(event) => setTerm(event.target.value)} className="mt-[8px] h-[32px] w-full rounded-[3px] border border-[#8b98a3] bg-white px-[8px] text-[12px] outline-none focus:border-[#0073cf]">
          <option value="current">{shortDate(policy.effectiveDate)} - {shortDate(policy.expirationDate)} ({policy.status === 'Active' ? 'active' : policy.status.toLowerCase()})</option>
          {renewal && <option value="renewal">{shortDate(renewal.effectiveDate)} - {shortDate(renewal.expirationDate)} (renewal)</option>}
        </select>
        {term === 'renewal' && renewal && <p className="mt-[6px] rounded-[3px] bg-[#eef5fb] px-[8px] py-[6px] text-[11.5px] text-[#2f4a66]">Renewal term {renewal.status.toLowerCase()}: {formatCurrency(renewal.premium)} ({renewal.billPlanName}).</p>}
        <div className="mt-[8px] text-[12px] text-[#1f2a33]">{stateCode(policy)} | {statusText(policy)}</div>
        <button type="button" onClick={actions.loyalty} className={`mt-[6px] flex items-center gap-[8px] text-[12px] text-[#0073cf] underline hover:text-[#0056b3] ${focus}`}><Star size={15} className="fill-[#f2c94c] text-[#b8860b]" />{level} Rewards</button>
      </div>
      <ul className="border-t border-[#e5e9ec]">
        <Row icon={<Settings size={18} />} label="Agency Actions" more active={panel === 'actions'} onClick={() => toggle('actions')} />
        <Row icon={<NotebookPen size={18} />} label="Agency Notes" active={panel === 'notes'} onClick={() => toggle('notes')} />
        <Row icon={<Banknote size={18} />} label="Billing and Payments" more active={panel === 'billing'} onClick={() => toggle('billing')} />
        <Row icon={<ClipboardList size={18} />} label="Claims" onClick={go(() => openPage('claims'))} />
        <Row icon={<CircleCheck size={18} />} label="Coverages" onClick={go(() => actions.scrollTo('coverage-0'))} />
        <Row icon={<UserRound size={18} />} label="Customer Information" more active={panel === 'customer'} onClick={() => toggle('customer')} />
        <Row icon={<Star size={18} />} label="Discounts and Rewards" more active={panel === 'discounts'} onClick={() => toggle('discounts')} />
        <Row icon={<Users size={18} />} label={auto ? 'Drivers' : 'Operators'} more active={panel === 'drivers'} onClick={() => toggle('drivers')} />
        <Row icon={<IdCard size={18} />} label="ID Cards and Documents" more active={panel === 'documents'} onClick={() => toggle('documents')} />
        <Row icon={<ShieldCheck size={18} />} label="Policy Activity" onClick={go(() => openPolicy(policy.id, 'history'))} />
        <Row icon={<KeyRound size={18} />} label={auto ? 'Vehicles' : 'Units'} more active={panel === 'vehicles'} onClick={() => toggle('vehicles')} />
      </ul>
    </nav>
    {panel === 'notes' && <NotesPanel policy={policy} onClose={() => onPanel(null)} />}
    {current && panel !== 'notes' && <Panel title={current.title} onClose={() => onPanel(null)}>{current.rows && <Summary rows={current.rows} />}<Links items={current.items} /></Panel>}
  </>;
}
