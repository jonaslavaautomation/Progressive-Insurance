// Customer Summary: every policy for one customer with its status, quick links (ID cards and
// documents, policy changes, last payment) and a cross-sell prompt.
import { AlertCircle, ChevronRight, KeyRound } from 'lucide-react';
import type { PolicyRecord } from '@/types/policy';
import { useQuote } from '@/context/useQuote';
import { customerKey } from '@/servicing/policyFilters';
import { formatCurrency } from '@/utils/masks';
import { BackLink, PortalLayout } from '@/servicing/portal/PortalLayout';
import { POLICY_ICONS, customerSince } from '@/servicing/portal/portalUtils';


/** Short status line shown in red under a policy that needs attention. */
function statusLine(policy: PolicyRecord): string {
  if (policy.pendingCancel) {
    if (policy.pendingCancel.kind === 'nonpayment') return policy.ledger.some((entry) => entry.type === 'Returned Payment') ? 'Pending cancel for returned payment' : 'Pending cancel for nonpayment';
    return policy.pendingCancel.kind === 'company' ? 'Pending cancel for underwriting reasons' : 'Pending cancel at the insured’s request';
  }
  if (policy.status === 'Cancelled') return `Cancelled effective ${policy.cancellation?.effectiveDate ?? ''}`;
  if (policy.status === 'Expired' || policy.status === 'Non-Renewed') return `${policy.status} ${policy.expirationDate}`;
  if (policy.renewal?.status === 'Offered') return `Renewal offered: ${formatCurrency(policy.renewal.dueToday)} due by ${policy.renewal.effectiveDate}`;
  return '';
}

function lastPaymentLine(policy: PolicyRecord): string {
  const payment = [...policy.ledger].reverse().find((entry) => entry.type === 'Payment' || entry.type === 'Automatic Payment');
  const enrolled = policy.autopay ? (policy.billPlanId === 'CARD' ? 'Enrolled in recurring card payments' : 'Enrolled in EFT') : policy.billPlanName;
  return payment ? `${formatCurrency(-payment.amount)} received ${payment.date}, ${enrolled}` : `No payments received yet, ${enrolled}`;
}

function PolicyCard({ policy }: { policy: PolicyRecord }) {
  const { openPolicy, openProof } = useQuote();
  const alert = statusLine(policy);
  const tone = policy.status === 'Cancelled' || policy.status === 'Expired' || policy.status === 'Non-Renewed' ? { bar: 'bg-[#6b7780]', border: 'border-[#6b7780]' } : alert ? { bar: 'bg-[#ff8a3d]', border: 'border-[#ff8a3d]' } : { bar: 'bg-[#003865]', border: 'border-[#003865]' };
  const Icon = POLICY_ICONS[policy.product];
  const link = 'flex items-center gap-1 text-left text-[12.5px] font-bold text-[#003865] underline underline-offset-2 hover:text-[#0073cf]';
  const product = policy.productName.replace(' (HO4)', '');
  return <section className={`mb-4 overflow-hidden rounded-[3px] border ${tone.border}`}>
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-[10px] py-[12px] text-white ${tone.bar}`}>
      <button type="button" onClick={() => openPolicy(policy.id)} className="text-[14px] font-bold underline underline-offset-2 hover:text-[#fff3e6]">{product} Policy</button>
      <span className="text-[14px] font-bold">{policy.policyNumber}, NC</span>
      <span className="text-[11.5px]">Coverage from {policy.effectiveDate} to {policy.expirationDate}</span>
    </div>
    <div className="bg-white px-[16px] py-[12px]">
      {alert && <div className="mb-1 flex items-center gap-2 text-[14px] font-bold text-[#e8242b]"><AlertCircle size={22} fill="#e8242b" className="text-white" />{alert}</div>}
      <div className="flex items-center gap-6">
        <Icon size={64} strokeWidth={1.2} className="ml-[20px] shrink-0 text-[#1d4f91]" fill="#1d4f91" fillOpacity={0.12} />
        <ul className="space-y-[2px] py-1">
          {alert && <li><button type="button" onClick={() => openPolicy(policy.id, policy.pendingCancel?.kind === 'nonpayment' || policy.renewal ? 'billing' : 'summary')} className={`${link} font-medium text-[#3d4b55]`}><ChevronRight size={13} className="text-[#e87722]" />{alert}</button></li>}
          <li><button type="button" onClick={() => openProof(policy.id)} className={link}><ChevronRight size={13} className="text-[#e87722]" />Get ID Cards and Documents</button></li>
          {policy.status === 'Active' || policy.status === 'Pending Cancel'
            ? <li><button type="button" onClick={() => openPolicy(policy.id, 'summary', policy.status === 'Active' ? 'change' : '')} className={link}><ChevronRight size={13} className="text-[#e87722]" />Quote or Make Changes to {policy.product === 'auto' || policy.product === 'commercialAuto' ? 'Drivers, Vehicles, Coverage, or Contact Info' : 'Coverage or Contact Info'}</button></li>
            : <li><button type="button" onClick={() => openPolicy(policy.id)} className={link}><ChevronRight size={13} className="text-[#e87722]" />View policy and reinstatement options</button></li>}
          <li><button type="button" onClick={() => openPolicy(policy.id, 'billing')} className={link}><ChevronRight size={13} className="text-[#e87722]" />{lastPaymentLine(policy)}</button></li>
        </ul>
      </div>
    </div>
  </section>;
}

export function CustomerSummary() {
  const { state, openPending, showDashboard, startQuote, updateInsured, updateAddress } = useQuote();
  const policies = state.policies.filter((policy) => customerKey(policy) === state.ui.customerKey);
  const first = policies[0];
  if (!first) return <PortalLayout><BackLink label="Back to Dashboard" onClick={showDashboard} /><p className="text-[14px]">Customer not found.</p></PortalLayout>;
  const personal = first.source.kind === 'personal';
  const name = personal ? [first.insured.firstName, first.insured.lastName].filter(Boolean).join(' ') : first.insured.name;
  const hasRenters = policies.some((policy) => policy.product === 'renters');
  const offer = personal ? (hasRenters ? (policies.some((policy) => policy.product === 'auto') ? null : 'Auto') : 'Renters') : null;
  const quoteOffer = () => {
    if (first.source.kind !== 'personal') return;
    const { insured } = first.source.quote;
    startQuote([offer === 'Auto' ? 'auto' : 'renters']);
    updateInsured({ firstName: insured.firstName, middleInitial: insured.middleInitial, lastName: insured.lastName, suffix: insured.suffix, dob: insured.dob, gender: insured.gender, email: insured.email, phones: insured.phones });
    updateAddress(insured.address);
  };
  return <PortalLayout>
    <BackLink label="Back to Pending Cancellations & Renewals" onClick={() => openPending()} />
    <h1 className="text-[24px] font-light">Customer Summary</h1>
    <h2 className="mt-3 text-[15px] font-bold text-[#3d4b55]">{name}&rsquo;s Policies</h2>
    <p className="mt-3 text-[12.5px]">Thank you for keeping this valued customer since {customerSince(policies)}</p>
    {offer && <div className="mt-4 flex items-center gap-3 text-[12.5px] italic"><KeyRound size={22} strokeWidth={1.3} className="-rotate-45" />Please offer to quote a <b>{offer} Policy</b> to the Customer.<button type="button" onClick={quoteOffer} className="rounded-[2px] bg-[#003865] px-[12px] py-[6px] text-[12px] font-bold not-italic text-white hover:bg-[#0073cf]">Quote Product</button></div>}
    <div className="mt-6">{policies.map((policy) => <PolicyCard key={policy.id} policy={policy} />)}</div>
  </PortalLayout>;
}
