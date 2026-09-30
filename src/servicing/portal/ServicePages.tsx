// Manage Policies / Prospecting pages: Billing Center, e-Sign Follow-Up, Claims Center (with First
// Notice of Loss), Requote Prospects and Cross-Sell Opportunities.
import { useState, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ClaimRecord, PolicyRecord } from '@/types/policy';
import type { ProductKey } from '@/products/types';
import { useQuote } from '@/context/useQuote';
import { customerKey } from '@/servicing/policyFilters';
import { PaymentModal } from '@/servicing/PolicyView';
import { claimsOf, crossSellOpportunities, inForce, prospects } from '@/servicing/portal/bookStats';
import { PortalLayout } from '@/servicing/portal/PortalLayout';
import { blueButton, cell, headCell, smallButton } from '@/servicing/portal/pageStyles';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';
import { InlineError, SelectControl, TextControl } from '@/components/wizard/primitives';
import { runWithSpinner } from '@/services/processing';
import { formatCurrency } from '@/utils/masks';
import { parseDate } from '@/utils/dates';


export function PageTitle({ title, intro }: { title: string; intro?: ReactNode }) {
  return <div className="min-w-0 flex-1"><h1 className="text-[24px] font-light">{title}</h1>{intro && <p className="mt-2 max-w-[980px] text-[12.5px] text-[#3d4b55]">{intro}</p>}</div>;
}

export function Tiles({ tiles }: { tiles: [string, string][] }) {
  return <div className="mt-4 grid max-w-[980px] grid-cols-2 gap-3 md:grid-cols-4">{tiles.map(([label, value]) => <div key={label} className="rounded-[3px] border border-[#cfdbe3] bg-[#f6f9fb] px-3 py-2"><div className="text-[10.5px] font-bold uppercase tracking-[.3px] text-[#5c6670]">{label}</div><div className="mt-1 text-[20px] font-bold text-[#003865]">{value}</div></div>)}</div>;
}

export function Notice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  if (!text) return null;
  return <p role="status" className="mt-3 flex max-w-[980px] items-start gap-2 rounded-[3px] border border-[#0f7a52] bg-[#eef8f3] px-3 py-2 text-[12.5px]"><CheckCircle2 size={16} className="mt-px shrink-0 text-[#0f7a52]" /><span className="flex-1">{text}</span><button type="button" onClick={onDismiss} className="underline">Dismiss</button></p>;
}

function InsuredLink({ policy }: { policy: PolicyRecord }) {
  const { openCustomer } = useQuote();
  return <button type="button" onClick={() => openCustomer(customerKey(policy))} className="text-left font-bold text-[#003865] underline underline-offset-2 hover:text-[#0073cf]">{policy.insured.name}</button>;
}

function PolicyLink({ policy }: { policy: PolicyRecord }) {
  const { openPolicy } = useQuote();
  return <button type="button" onClick={() => openPolicy(policy.id)} className="text-left text-[#003865] underline underline-offset-2 hover:text-[#0073cf]">{policy.policyNumber}</button>;
}

// ------------------------------------------------------------------ Billing Center

export function BillingPage() {
  const { state, engine, lastConfirmation } = useQuote();
  const day = state.simDate;
  const [filter, setFilter] = useState<'all' | 'pastDue' | 'dueSoon' | 'autopay'>('all');
  const [paying, setPaying] = useState<PolicyRecord | null>(null);
  const [notice, setNotice] = useState('');
  const policies = state.policies.filter(inForce);
  const rows = policies.map((policy) => {
    const next = engine.nextInstallment(policy);
    return { policy, next, pastDue: engine.pastDue(policy, day), minimum: engine.minimumDue(policy, day), balance: engine.balance(policy) };
  }).filter((row) => filter === 'all' || (filter === 'pastDue' ? row.pastDue > 0 : filter === 'autopay' ? row.policy.autopay : !!row.next && engine.dayDiff(day, row.next.due) <= 30))
    .sort((a, b) => b.pastDue - a.pastDue || (a.next && b.next ? engine.dayDiff(b.next.due, a.next.due) : 0));
  const total = (pick: (policy: PolicyRecord) => number) => formatCurrency(policies.reduce((sum, policy) => sum + pick(policy), 0));
  return <PortalLayout crumbs={[{ label: 'Manage Policies' }, { label: 'Billing Center' }]}>
    <PageTitle title="Billing Center" intro="Balances, upcoming installments and past-due amounts for every policy in force. Take a payment, or open the policy to change the bill plan or set up automatic payments." />
    <Tiles tiles={[['Policies in force', String(policies.length)], ['Total balance', total((policy) => engine.balance(policy))], ['Past due now', total((policy) => engine.pastDue(policy, day))], ['On automatic payments', String(policies.filter((policy) => policy.autopay).length)]]} />
    <Notice text={notice} onDismiss={() => setNotice('')} />
    <div role="tablist" className="mt-5 flex gap-2 text-[12px]">{([['all', 'All policies'], ['pastDue', 'Past due'], ['dueSoon', 'Due in the next 30 days'], ['autopay', 'Automatic payments']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className={`h-[30px] rounded-[2px] border px-3 font-bold ${filter === key ? 'border-[#0073cf] bg-[#0073cf] text-white' : 'border-[#9aa5ad] bg-[#f3f2ed] text-[#1b2a36] hover:bg-white'}`}>{label}</button>)}</div>
    <table className="mt-3 w-full border-collapse text-[12px]"><thead><tr>{['Named Insured', 'Policy', 'Product', 'Bill Plan', 'Next Due', 'Next Amount', 'Past Due', 'Balance', ''].map((label) => <th key={label} className={headCell}>{label}</th>)}</tr></thead><tbody>
      {rows.map(({ policy, next, pastDue, minimum, balance }) => <tr key={policy.id} className="odd:bg-white even:bg-[#f7f7f4]">
        <td className={cell}><InsuredLink policy={policy} /></td><td className={cell}><PolicyLink policy={policy} /></td><td className={cell}>{policy.productName}</td>
        <td className={cell}>{policy.billPlanName}{policy.autopay && <span className="ml-1 rounded-[2px] bg-[#e6f4ef] px-1 text-[10px] font-bold text-[#0b5d3f]">AUTOPAY</span>}</td>
        <td className={cell}>{next?.due ?? '—'}</td><td className={cell}>{next ? formatCurrency(next.amount - next.paid) : '—'}</td>
        <td className={`${cell} ${pastDue > 0 ? 'font-bold text-[#c8102e]' : ''}`}>{formatCurrency(pastDue)}</td><td className={cell}>{formatCurrency(balance)}</td>
        <td className={cell}><button type="button" onClick={() => setPaying(policy)} disabled={balance <= 0 && minimum <= 0} className={smallButton}>Make Payment</button></td>
      </tr>)}
      {!rows.length && <tr><td colSpan={9} className={`${cell} text-center text-[#5c6670]`}>No policies match this filter.</td></tr>}
    </tbody></table>
    {paying && <PaymentModal policy={state.policies.find((entry) => entry.id === paying.id) ?? paying} onClose={(text) => { setPaying(null); if (text) setNotice(`${paying.insured.name}, policy #${paying.policyNumber}: ${text} Confirmation #${lastConfirmation()}.`); }} />}
  </PortalLayout>;
}

// ------------------------------------------------------------------ e-Sign Follow-Up

export function EsignPage() {
  const { state, servicePolicy, engine, lastConfirmation } = useQuote();
  const [notice, setNotice] = useState('');
  const pending = state.policies.filter((policy) => policy.esign === 'Pending' && policy.status !== 'Cancelled');
  const resend = (policy: PolicyRecord) => {
    servicePolicy(policy.id, (record, day) => ({ ...record, history: [...record.history, { id: `his-${Math.random().toString(36).slice(2, 9)}`, date: day, event: 'e-Sign link resent', detail: `Signing link emailed to ${record.insured.email || 'the customer'}.` }] }));
    setNotice(`e-Sign link resent to ${policy.insured.email || policy.insured.name}. Confirmation #${lastConfirmation()}.`);
  };
  const sign = (policy: PolicyRecord) => {
    servicePolicy(policy.id, (record, day) => engine.markSigned(record, day));
    setNotice(`Policy #${policy.policyNumber} marked as signed. Confirmation #${lastConfirmation()}.`);
  };
  return <PortalLayout crumbs={[{ label: 'Manage Policies' }, { label: 'e-Sign Follow-Up' }]}>
    <PageTitle title="e-Sign Follow-Up" intro="Applications waiting for the customer's electronic signature. Unsigned applications must be completed within 10 days of binding or the policy may be cancelled." />
    <Notice text={notice} onDismiss={() => setNotice('')} />
    <table className="mt-4 w-full border-collapse text-[12px]"><thead><tr>{['Named Insured', 'Policy', 'Product', 'Bound', 'Days Outstanding', 'Sent To', ''].map((label) => <th key={label} className={headCell}>{label}</th>)}</tr></thead><tbody>
      {pending.map((policy) => { const days = engine.dayDiff(policy.issuedOn, state.simDate); return <tr key={policy.id} className="odd:bg-white even:bg-[#f7f7f4]">
        <td className={cell}><InsuredLink policy={policy} /></td><td className={cell}><PolicyLink policy={policy} /></td><td className={cell}>{policy.productName}</td><td className={cell}>{policy.issuedOn}</td>
        <td className={`${cell} ${days > 10 ? 'font-bold text-[#c8102e]' : ''}`}>{days}</td><td className={cell}>{policy.insured.email || '—'}</td>
        <td className={cell}><div className="flex gap-2"><button type="button" onClick={() => resend(policy)} className={smallButton}>Resend e-Sign Link</button><button type="button" onClick={() => sign(policy)} className={smallButton}>Mark as Signed</button></div></td>
      </tr>; })}
      {!pending.length && <tr><td colSpan={7} className={`${cell} text-center text-[#5c6670]`}>No applications are waiting for a signature.</td></tr>}
    </tbody></table>
  </PortalLayout>;
}

// ------------------------------------------------------------------ Claims Center

const LOSS_TYPES: Record<string, string[]> = {
  vehicle: ['Collision - at fault', 'Collision - not at fault', 'Comprehensive - animal strike', 'Comprehensive - glass', 'Comprehensive - theft', 'Comprehensive - weather/hail', 'Liability - injury to others', 'Uninsured motorist'],
  property: ['Theft - personal property', 'Water damage', 'Fire/smoke', 'Liability - injury to others'],
  commercial: ['Collision - at fault', 'Collision - not at fault', 'General liability - bodily injury', 'Property damage - premises', 'Employment practices claim', 'Cyber incident'],
};
const ADJUSTERS: Record<string, string[]> = { vehicle: ['Auto Claims Team 3', 'Auto Claims Team 7', 'Auto Claims Team 12'], property: ['Property Claims Team 4', 'Property Claims Team 9'], commercial: ['Commercial Claims Unit 2', 'Commercial Claims Unit 5'] };

function ReportClaimModal({ onClose }: { onClose: (message?: string) => void }) {
  const { state, servicePolicy, lastConfirmation, engine } = useQuote();
  const policies = state.policies.filter(inForce);
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? '');
  const policy = policies.find((entry) => entry.id === policyId);
  const group = !policy ? 'vehicle' : policy.source.kind === 'commercial' ? 'commercial' : policy.product === 'renters' ? 'property' : 'vehicle';
  const [form, setForm] = useState({ lossDate: state.simDate, type: '', unit: '', description: '', injuries: 'No', police: '', atFault: 'Undetermined' });
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const submit = () => {
    if (!policy) { setError('Select the policy the claim is for.'); return; }
    if (!parseDate(form.lossDate)) { setError('Enter the date of loss (MM/DD/YYYY).'); return; }
    if (engine.dayDiff(form.lossDate, state.simDate) < 0) { setError('The date of loss cannot be in the future.'); return; }
    if (engine.dayDiff(policy.effectiveDate, form.lossDate) < 0 && policy.termNumber === 1) { setError(`The date of loss is before the policy started (${policy.effectiveDate}).`); return; }
    if (!form.type) { setError('Select the type of loss.'); return; }
    if (form.description.trim().length < 15) { setError('Describe what happened (at least 15 characters).'); return; }
    const unit = form.unit || policy.units[0]?.label || policy.productName;
    const year = form.lossDate.slice(8);
    const claim: ClaimRecord = { id: `clm-${Math.random().toString(36).slice(2, 9)}`, claimNumber: `${year}-${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`, lossDate: form.lossDate, reportedOn: state.simDate, type: form.type, description: `${form.description.trim()}${form.injuries === 'Yes' ? ' Injuries reported.' : ''}${form.police ? ` Police report ${form.police}.` : ''}`, status: 'Open - Assigned', paid: 0, adjuster: ADJUSTERS[group][Math.floor(Math.random() * ADJUSTERS[group].length)], atFault: form.atFault as ClaimRecord['atFault'], unit };
    runWithSpinner('Submitting claim...', () => {
      const result = servicePolicy(policy.id, (record, day) => ({ ...record, claims: [...(record.claims ?? []), claim], history: [...record.history, { id: `his-${claim.id}`, date: day, event: 'Claim reported', detail: `Claim #${claim.claimNumber}: ${claim.type} on ${claim.lossDate}. Assigned to ${claim.adjuster}.` }] }));
      if (result) { setError(result); return; }
      onClose(`Claim #${claim.claimNumber} reported for ${policy.insured.name} and assigned to ${claim.adjuster}. The adjuster contacts the customer within one business day. Confirmation #${lastConfirmation()}.`);
    });
  };
  const field = (label: string, control: ReactNode, wide = false) => <label className={`block text-[13px] ${wide ? 'col-span-2' : ''}`}><span className="mb-1 block font-medium">{label}</span>{control}</label>;
  return <Modal title="Report a Claim (First Notice of Loss)" width={760} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.primary} onClick={submit}>Submit Claim</button></>}>
    <div className="grid grid-cols-2 gap-3">
      {field('Policy', <SelectControl value={policyId} options={policies.map((entry) => ({ value: entry.id, label: `${entry.insured.name} · ${entry.productName} #${entry.policyNumber}` }))} onChange={(value) => { setPolicyId(value); set({ type: '', unit: '' }); }} />, true)}
      {field('Date of loss', <TextControl value={form.lossDate} mask="date" onChange={(lossDate) => set({ lossDate })} />)}
      {field('Type of loss', <SelectControl value={form.type} options={LOSS_TYPES[group]} onChange={(type) => set({ type })} />)}
      {policy && policy.units.length > 0 && field(policy.product === 'renters' ? 'Location' : 'Vehicle / unit involved', <SelectControl value={form.unit || policy.units[0].label} options={policy.units.map((unit) => unit.label)} onChange={(unit) => set({ unit })} />)}
      {field('Fault (customer’s account)', <SelectControl value={form.atFault} options={['Undetermined', 'Yes', 'No']} onChange={(atFault) => set({ atFault })} />)}
      {field('Anyone injured?', <SelectControl value={form.injuries} options={['No', 'Yes']} onChange={(injuries) => set({ injuries })} />)}
      {field('Police report number (optional)', <TextControl value={form.police} onChange={(police) => set({ police })} />)}
      {field('What happened?', <textarea value={form.description} onChange={(event) => set({ description: event.target.value })} rows={4} className="w-full rounded-[3px] border border-[#7b8a95] p-2 text-[13px] outline-none focus:border-[#003865]" />, true)}
    </div>
    <InlineError message={error} />
  </Modal>;
}

export function ClaimsPage() {
  const { state } = useQuote();
  const [reporting, setReporting] = useState(false);
  const [detail, setDetail] = useState<{ claim: ClaimRecord; policy: PolicyRecord } | null>(null);
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');
  const claims = claimsOf(state.policies);
  const shown = claims.filter(({ claim }) => status === 'all' || (status === 'open' ? claim.status.startsWith('Open') : claim.status.startsWith('Closed')));
  return <PortalLayout crumbs={[{ label: 'Manage Policies' }, { label: 'Claims Center' }]}>
    <div className="flex items-start justify-between"><PageTitle title="Claims Center" intro="Claims reported by your customers. Report a new claim (First Notice of Loss) for any policy in force; it is assigned to an adjuster right away." /><button type="button" onClick={() => setReporting(true)} className={blueButton}>Report a Claim</button></div>
    <Tiles tiles={[['Open claims', String(claims.filter(({ claim }) => claim.status.startsWith('Open')).length)], ['Closed claims', String(claims.filter(({ claim }) => claim.status.startsWith('Closed')).length)], ['Paid to date', formatCurrency(claims.reduce((sum, { claim }) => sum + claim.paid, 0))], ['Customers with claims', String(new Set(claims.map(({ policy }) => customerKey(policy))).size)]]} />
    <Notice text={notice} onDismiss={() => setNotice('')} />
    <div className="mt-5 flex gap-2 text-[12px]">{([['all', 'All claims'], ['open', 'Open'], ['closed', 'Closed']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setStatus(key)} className={`h-[30px] rounded-[2px] border px-3 font-bold ${status === key ? 'border-[#0073cf] bg-[#0073cf] text-white' : 'border-[#9aa5ad] bg-[#f3f2ed] hover:bg-white'}`}>{label}</button>)}</div>
    <table className="mt-3 w-full border-collapse text-[12px]"><thead><tr>{['Claim #', 'Named Insured', 'Policy', 'Loss Date', 'Type', 'Status', 'Paid', 'Adjuster'].map((label) => <th key={label} className={headCell}>{label}</th>)}</tr></thead><tbody>
      {[...shown].reverse().map(({ claim, policy }) => <tr key={claim.id} className="odd:bg-white even:bg-[#f7f7f4]">
        <td className={cell}><button type="button" onClick={() => setDetail({ claim, policy })} className="font-bold text-[#003865] underline underline-offset-2 hover:text-[#0073cf]">{claim.claimNumber}</button></td>
        <td className={cell}><InsuredLink policy={policy} /></td><td className={cell}><PolicyLink policy={policy} /></td><td className={cell}>{claim.lossDate}</td><td className={cell}>{claim.type}</td>
        <td className={cell}><span className={`rounded-[2px] px-1 text-[11px] font-bold ${claim.status.startsWith('Open') ? 'bg-[#fff1e2] text-[#a84c00]' : 'bg-[#e6f4ef] text-[#0b5d3f]'}`}>{claim.status}</span></td>
        <td className={cell}>{formatCurrency(claim.paid)}</td><td className={cell}>{claim.adjuster}</td>
      </tr>)}
      {!shown.length && <tr><td colSpan={8} className={`${cell} text-center text-[#5c6670]`}>No claims to show.</td></tr>}
    </tbody></table>
    {reporting && <ReportClaimModal onClose={(message) => { setReporting(false); if (message) setNotice(message); }} />}
    {detail && <Modal title={`Claim #${detail.claim.claimNumber}`} width={620} onClose={() => setDetail(null)} footer={<button type="button" className={modalButton.primary} onClick={() => setDetail(null)}>Close</button>}>
      <table className="w-full border-collapse text-[13px]"><tbody>{([['Named insured', detail.policy.insured.name], ['Policy', `${detail.policy.productName} #${detail.policy.policyNumber}`], ['Unit', detail.claim.unit], ['Date of loss', detail.claim.lossDate], ['Reported', detail.claim.reportedOn], ['Type of loss', detail.claim.type], ['At fault', detail.claim.atFault], ['Status', detail.claim.status], ['Paid to date', formatCurrency(detail.claim.paid)], ['Adjuster', detail.claim.adjuster], ['Description', detail.claim.description]] as [string, string][]).map(([label, value]) => <tr key={label}><td className="w-[34%] border border-[#d7e0e6] bg-[#f6f9fb] px-3 py-[6px] font-medium">{label}</td><td className="border border-[#d7e0e6] px-3 py-[6px]">{value}</td></tr>)}</tbody></table>
    </Modal>}
  </PortalLayout>;
}

// ------------------------------------------------------------------ Prospecting

export function ProspectsPage() {
  const { state, startQuoteFor } = useQuote();
  const list = prospects(state.policies);
  const requote = (policy: PolicyRecord) => runWithSpinner('Creating quote...', () => startQuoteFor(policy.id, [policy.product as ProductKey]));
  return <PortalLayout crumbs={[{ label: 'Prospecting' }, { label: 'Requote Prospects' }]}>
    <PageTitle title="Requote Prospects" intro="Former customers whose policies cancelled, expired or were non-renewed. Requote them with their prior drivers, vehicles and address already filled in." />
    <table className="mt-4 w-full border-collapse text-[12px]"><thead><tr>{['Named Insured', 'Policy', 'Product', 'Status', 'Ended', 'Reason', 'Last Premium', ''].map((label) => <th key={label} className={headCell}>{label}</th>)}</tr></thead><tbody>
      {list.map((policy) => <tr key={policy.id} className="odd:bg-white even:bg-[#f7f7f4]">
        <td className={cell}><InsuredLink policy={policy} /></td><td className={cell}><PolicyLink policy={policy} /></td><td className={cell}>{policy.productName}</td><td className={cell}>{policy.status}</td>
        <td className={cell}>{policy.cancellation?.effectiveDate ?? policy.expirationDate}</td><td className={cell}>{policy.cancellation?.reason ?? policy.nonRenewal?.reason ?? 'Renewal not paid'}</td><td className={cell}>{formatCurrency(policy.termPremium)}</td>
        <td className={cell}>{policy.source.kind === 'personal' && <button type="button" onClick={() => requote(policy)} className={smallButton}>Requote</button>}</td>
      </tr>)}
      {!list.length && <tr><td colSpan={8} className={`${cell} text-center text-[#5c6670]`}>No cancelled, expired or non-renewed policies right now. Every customer in the book is still in force.</td></tr>}
    </tbody></table>
  </PortalLayout>;
}

const OFFER_TEXT: Record<string, string> = { renters: 'Renters (HO4): protects belongings and adds the multi-policy discount on Auto.', auto: 'Auto: bundle with the existing policy for the multi-policy discount.', motorcycle: 'Motorcycle/ATV: ask about any bikes, ATVs or side-by-sides in the household.' };

export function CrossSellPage() {
  const { state, startQuoteFor } = useQuote();
  const list = crossSellOpportunities(state.policies);
  return <PortalLayout crumbs={[{ label: 'Prospecting' }, { label: 'Cross-Sell Opportunities' }]}>
    <PageTitle title="Cross-Sell Opportunities" intro="Customers who are missing a product that pairs with what they already have. Bundling adds the multi-policy discount and improves retention." />
    <table className="mt-4 w-full border-collapse text-[12px]"><thead><tr>{['Customer', 'Current Products', 'Recommended', 'Phone', ''].map((label) => <th key={label} className={headCell}>{label}</th>)}</tr></thead><tbody>
      {list.map((entry) => <tr key={entry.key} className="odd:bg-white even:bg-[#f7f7f4]">
        <td className={cell}><InsuredLink policy={entry.policy} /></td><td className={cell}>{entry.has.join(', ')}</td><td className={cell}>{OFFER_TEXT[entry.offer]}</td><td className={cell}>{entry.policy.insured.phone}</td>
        <td className={cell}><button type="button" onClick={() => runWithSpinner('Creating quote...', () => startQuoteFor(entry.policy.id, [entry.offer]))} className={smallButton}>Quote {entry.offer === 'renters' ? 'Renters' : entry.offer === 'auto' ? 'Auto' : 'Motorcycle'}</button></td>
      </tr>)}
      {!list.length && <tr><td colSpan={5} className={`${cell} text-center text-[#5c6670]`}>Every customer already has a bundled account.</td></tr>}
    </tbody></table>
  </PortalLayout>;
}
