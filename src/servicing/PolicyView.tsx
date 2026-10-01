// Manage Policies > policy: Summary, Billing, Documents, History, and the servicing workflows.
import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Info, RotateCcw } from 'lucide-react';
import type { PolicyDocument, PolicyRecord } from '@/types/policy';
import type { PolicyTab } from '@/context/quoteStore';
import { useQuote } from '@/context/useQuote';
import { runWithSpinner } from '@/services/processing';
import { rulesFor } from '@/data/states';
import { formatCurrency } from '@/utils/masks';
import { parseDate } from '@/utils/dates';
import { buildBillPlans } from '@/utils/ratingEngine';
import { productTab } from '@/products/configs';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';
import { InlineError, SelectControl, TextControl, WizardCard, WizardRow } from '@/components/wizard/primitives';
import { DocumentPreview } from '@/servicing/PolicyDocuments';
import { PacketButtons } from '@/servicing/PacketButtons';
import { ChangePolicyModal } from '@/servicing/ChangePolicy';
import { DOCUMENT_TITLES } from '@/servicing/documentTitles';
import { ServiceLayout, StatusBadge, TrainingClock, dangerButton, outlineButton, solidButton } from '@/servicing/ServiceChrome';

const TABS: [PolicyTab, string][] = [['summary', 'Policy Summary'], ['billing', 'Billing'], ['documents', 'Documents'], ['history', 'Policy History']];
const PAYMENT_METHODS = ['Bank account (EFT)', 'Credit/debit card via secure IVR', 'Check by mail', 'Cash at agency'];
const INSURED_REASONS = ['Sold or disposed of the insured property/vehicle', 'Replaced with other insurance', 'Moved out of state', 'No longer needs coverage', 'Premium too high', 'Other'];
const COMPANY_REASONS = ['Underwriting: material misrepresentation on the application', 'Underwriting: driver license suspended or revoked', 'Underwriting: fraud in obtaining coverage or presenting a claim'];
const NONRENEW_REASONS = ['Underwriting: loss history exceeds program guidelines', 'Underwriting: risk no longer meets eligibility guidelines', 'Company is withdrawing this program from the state'];

function Alert({ tone, icon, children }: { tone: 'red' | 'blue' | 'amber' | 'green' | 'grey'; icon?: ReactNode; children: ReactNode }) {
  const styles = { red: 'border-[#c8102e] bg-[#fdf0f1]', blue: 'border-[#0073cf] bg-[#e8f4fa]', amber: 'border-[#f5a45d] bg-[#fff6ee]', green: 'border-[#0f7a52] bg-[#e6f4ef]', grey: 'border-[#9aa6ae] bg-[#f3f5f6]' };
  return <div className={`mb-[16px] flex w-[1100px] items-start gap-[10px] rounded-[3px] border px-[16px] py-[12px] text-[14px] leading-[20px] ${styles[tone]}`}>{icon}<div className="flex-1">{children}</div></div>;
}

export function PaymentModal({ policy, preset, onClose }: { policy: PolicyRecord; preset?: number; onClose: (message?: string) => void }) {
  const { state, servicePolicy, engine } = useQuote();
  const day = state.simDate;
  const minimum = engine.minimumDue(policy, day);
  const next = engine.nextInstallment(policy);
  const owed = engine.balance(policy);
  const choices: [string, number][] = [
    ...(minimum > 0 ? [['Minimum amount due (past due + fees)', minimum] as [string, number]] : []),
    ...(next ? [[`Next installment (due ${next.due})`, Math.round((next.amount - next.paid + policy.feesDue) * 100) / 100] as [string, number]] : []),
    ...(preset ? [['Renewal down payment', preset] as [string, number]] : []),
    ...(owed > 0 ? [['Pay remaining balance', owed] as [string, number]] : []),
  ];
  const [choice, setChoice] = useState(preset ? 'Renewal down payment' : choices[0]?.[0] ?? 'Other amount');
  const [other, setOther] = useState('');
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [error, setError] = useState('');
  const amount = choice === 'Other amount' ? Number(other.replace(/[^\d.]/g, '')) : choices.find(([label]) => label === choice)?.[1] ?? 0;
  const submit = () => {
    if (!(amount > 0)) { setError('Enter a payment amount greater than $0.00.'); return; }
    runWithSpinner('Processing payment...', () => {
      const result = servicePolicy(policy.id, (record, today) => engine.makePayment(record, Math.round(amount * 100) / 100, method, today));
      if (result) { setError(result); return; }
      onClose(`Payment of ${formatCurrency(amount)} posted by ${method}.`);
    });
  };
  if (owed <= 0 && !preset) return <Modal title="Make a Payment" width={560} onClose={() => onClose()} footer={<button type="button" className={modalButton.blue} onClick={() => onClose()}>Close</button>}><p className="flex items-center gap-2 text-[14px]"><CheckCircle2 size={18} className="text-[#0f7a52]" />Policy #{policy.policyNumber} has no balance due{policy.billPlanId === 'PIF' ? ': it is paid in full for this term.' : '.'}</p></Modal>;
  return <Modal title="Make a Payment" width={620} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.blue} onClick={submit}>Submit Payment</button></>}>
    <p className="mb-3 text-[13px] text-[#5c6670]">Policy #{policy.policyNumber} · Current balance {formatCurrency(owed)}</p>
    <div className="space-y-[10px]">{[...choices, ['Other amount', 0] as [string, number]].map(([label, value]) => <label key={label} className="flex items-center gap-[10px] text-[14px]"><input type="radio" name="pay-amount" checked={choice === label} onChange={() => setChoice(label)} className="h-[20px] w-[20px] accent-[#003865]" /><span className="flex-1">{label}</span>{label !== 'Other amount' && <b>{formatCurrency(value)}</b>}</label>)}</div>
    {choice === 'Other amount' && <div className="mt-2 w-[200px]"><TextControl value={other} money mask="money" onChange={setOther} /></div>}
    <label className="mt-4 block text-[14px]">Payment method<SelectControl value={method} options={PAYMENT_METHODS} onChange={setMethod} /></label>
    <p className="mt-2 text-[12px] text-[#5c6670]">Training simulation: never enter real card or bank numbers. Payments are simulated.</p>
    <InlineError message={error} />
  </Modal>;
}

function CancelModal({ policy, onClose }: { policy: PolicyRecord; onClose: (message?: string) => void }) {
  const { state, servicePolicy, engine } = useQuote();
  const day = state.simDate;
  const [kind, setKind] = useState<'insured' | 'company'>('insured');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(day);
  const [method, setMethod] = useState<'Pro Rata' | 'Short Rate'>('Pro Rata');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const valid = !!parseDate(effectiveDate);
  const quote = valid ? engine.cancellationQuote(policy, effectiveDate, kind === 'company' ? 'Pro Rata' : method) : null;
  const request = { kind, reason, effectiveDate, method: kind === 'company' ? 'Pro Rata' as const : method };
  const submit = () => {
    const problem = engine.validateCancel(policy, request, day) || (!confirmed ? 'Confirm the customer (or underwriting) authorized this cancellation.' : '');
    if (problem) { setError(problem); return; }
    runWithSpinner('Submitting cancellation...', () => {
      const result = servicePolicy(policy.id, (record, today) => engine.requestCancel(record, request, today));
      if (result) { setError(result); return; }
      onClose(engine.dayDiff(day, effectiveDate) > 0 ? `Cancellation scheduled for ${effectiveDate}.` : 'Policy cancelled.');
    });
  };
  return <Modal title="Cancel Policy" width={720} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Keep Policy</button><button type="button" className={modalButton.primary} onClick={submit}>Submit Cancellation</button></>}>
    <div className="grid grid-cols-2 gap-4 text-[14px]">
      <fieldset><legend className="mb-1 font-bold">Requested by</legend>{(['insured', 'company'] as const).map((value) => <label key={value} className="flex items-center gap-2"><input type="radio" name="cancel-kind" checked={kind === value} onChange={() => { setKind(value); setReason(''); if (value === 'company') setEffectiveDate(engine.shiftDate(day, engine.NC_OTHER_NOTICE_DAYS)); else setEffectiveDate(day); }} className="h-[18px] w-[18px] accent-[#003865]" />{value === 'insured' ? 'Named insured' : 'Company (underwriting)'}</label>)}</fieldset>
      <label>Cancellation effective date<TextControl value={effectiveDate} mask="date" onChange={setEffectiveDate} className="mt-[10px] w-full" /></label>
      <label className="col-span-2">Reason<SelectControl value={reason} options={kind === 'insured' ? INSURED_REASONS : COMPANY_REASONS} onChange={setReason} /></label>
      {kind === 'insured' && <fieldset className="col-span-2"><legend className="mb-1 font-bold">Refund method</legend><div className="flex gap-6">{(['Pro Rata', 'Short Rate'] as const).map((value) => <label key={value} className="flex items-center gap-2"><input type="radio" name="cancel-method" checked={method === value} onChange={() => setMethod(value)} className="h-[18px] w-[18px] accent-[#003865]" />{value}{value === 'Short Rate' && <span className="text-[12px] text-[#5c6670]">(keeps {engine.SHORT_RATE_PENALTY * 100}% of unearned premium)</span>}</label>)}</div></fieldset>}
    </div>
    {kind === 'company' && <p className="mt-3 rounded-[3px] bg-[#fff6ee] px-3 py-2 text-[13px] text-[#9a4a0b]">{rulesFor(policy.state).name} requires at least {engine.otherNoticeDays(policy)} days&rsquo; written notice for a company cancellation other than nonpayment{policy.state === 'North Carolina' ? ' (N.C. Gen. Stat. § 58-36-85)' : ''}. A Notice of Cancellation will be mailed now.</p>}
    {quote && <table className="mt-3 w-full border-collapse text-[13px]"><tbody>
      {[['Days in force', `${quote.used} of ${quote.termDays}`], ['Premium earned', formatCurrency(quote.earned)], ...(quote.penalty ? [['Short rate penalty (included above)', formatCurrency(quote.penalty)]] : []), ['Payments received', formatCurrency(quote.paid)], ...(quote.fees ? [['Fees assessed', formatCurrency(quote.fees)]] : []), [quote.refund > 0 ? 'Estimated refund to customer' : 'Earned premium still due', formatCurrency(quote.refund > 0 ? quote.refund : quote.balanceDue)]].map(([label, value]) => <tr key={label}><td className="border border-[#d7e0e6] px-3 py-[6px]">{label}</td><td className="border border-[#d7e0e6] px-3 py-[6px] text-right font-bold">{value}</td></tr>)}
    </tbody></table>}
    <label className="mt-3 flex items-start gap-2 text-[13px]"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-px h-[18px] w-[18px] accent-[#003865]" />{kind === 'insured' ? 'The named insured requested this cancellation and understands coverage ends on the effective date.' : 'Underwriting approved this cancellation for the reason selected.'}</label>
    <InlineError message={error} />
  </Modal>;
}

function ReinstateModal({ policy, onClose }: { policy: PolicyRecord; onClose: (message?: string) => void }) {
  const { state, servicePolicy, engine } = useQuote();
  const check = engine.reinstatementCheck(policy, state.simDate);
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [error, setError] = useState('');
  const submit = () => {
    runWithSpinner('Reinstating policy...', () => {
      const result = servicePolicy(policy.id, (record, today) => engine.reinstate(record, method, today));
      if (result) { setError(result); return; }
      onClose('Policy reinstated.');
    });
  };
  return <Modal title="Reinstate Policy" width={600} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button>{check.allowed && <button type="button" className={modalButton.blue} onClick={submit}>Collect Payment &amp; Reinstate</button>}</>}>
    {check.allowed ? <>
      <p className="text-[14px]">Amount required to reinstate: <b>{formatCurrency(check.amount)}</b> (past-due installments and fees).</p>
      {check.lapse ? <p className="mt-2 flex gap-2 rounded-[3px] bg-[#fdf0f1] px-3 py-2 text-[13px] text-[#c8102e]"><AlertTriangle size={16} className="mt-px shrink-0" />Reinstating today creates a lapse in coverage from {policy.cancellation?.effectiveDate} through {engine.shiftDate(state.simDate, -1)}. Losses in that period are not covered.</p> : <p className="mt-2 text-[13px] text-[#0b5d3f]">Reinstating today restores coverage with no lapse.</p>}
      <label className="mt-3 block text-[14px]">Payment method<SelectControl value={method} options={PAYMENT_METHODS} onChange={setMethod} /></label>
    </> : <p className="text-[14px] text-[#c8102e]">{check.reason}</p>}
    <InlineError message={error} />
  </Modal>;
}

function BillPlanModal({ policy, onClose }: { policy: PolicyRecord; onClose: (message?: string) => void }) {
  const { servicePolicy, engine } = useQuote();
  const plans = buildBillPlans(policy.fullTermPremium, policy.termMonths).filter((plan) => plan.id === 'EFT' || plan.id === 'CARD' || plan.id === 'MAIL');
  const [choice, setChoice] = useState(plans.some((plan) => plan.id === policy.billPlanId) ? policy.billPlanId : 'EFT');
  const [error, setError] = useState('');
  const submit = () => {
    const result = servicePolicy(policy.id, (record, today) => engine.changeBillPlan(record, choice, today));
    if (result) { setError(result); return; }
    onClose('Bill plan changed.');
  };
  return <Modal title="Change Bill Plan" width={600} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.blue} onClick={submit}>Change Bill Plan</button></>}>
    <p className="mb-3 text-[13px] text-[#5c6670]">Current plan: {policy.billPlanName}. The new plan applies to the remaining installments.</p>
    <div className="space-y-[10px]">{plans.map((plan) => <label key={plan.id} className="flex items-center gap-[10px] text-[14px]"><input type="radio" name="bill-plan-change" checked={choice === plan.id} onChange={() => setChoice(plan.id)} className="h-[20px] w-[20px] accent-[#003865]" /><span className="flex-1"><b>{plan.name}</b> <span className="text-[12px] text-[#5c6670]">{plan.detail}</span></span><span className="text-[13px]">{formatCurrency(plan.feePerPayment)} fee per payment</span></label>)}</div>
    <InlineError message={error} />
  </Modal>;
}

function NonRenewModal({ policy, onClose }: { policy: PolicyRecord; onClose: (message?: string) => void }) {
  const { servicePolicy, engine } = useQuote();
  const [by, setBy] = useState<'insured' | 'company'>('insured');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const result = servicePolicy(policy.id, (record, today) => (by === 'insured' ? engine.declineRenewal(record, today) : engine.companyNonRenew(record, reason, today)));
    if (result) { setError(result); return; }
    onClose(by === 'insured' ? 'Renewal declined. The policy will expire at the end of the term.' : 'Non-renewal notice mailed.');
  };
  return <Modal title="Non-Renew Policy" width={640} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.primary} onClick={submit}>Submit</button></>}>
    <fieldset className="text-[14px]"><legend className="mb-1 font-bold">Requested by</legend>{(['insured', 'company'] as const).map((value) => <label key={value} className="flex items-center gap-2"><input type="radio" name="nonrenew-by" checked={by === value} onChange={() => setBy(value)} className="h-[18px] w-[18px] accent-[#003865]" />{value === 'insured' ? 'Named insured does not want to renew' : 'Company non-renewal (underwriting)'}</label>)}</fieldset>
    {by === 'company' && <><label className="mt-3 block text-[14px]">Reason<SelectControl value={reason} options={NONRENEW_REASONS} onChange={setReason} /></label><p className="mt-2 text-[13px] text-[#9a4a0b]">North Carolina requires at least {engine.NC_OTHER_NOTICE_DAYS} days&rsquo; notice before expiration ({policy.expirationDate}).</p></>}
    <InlineError message={error} />
  </Modal>;
}

type Dialog = 'pay' | 'renewalPay' | 'cancel' | 'reinstate' | 'billplan' | 'nonrenew' | 'change' | null;

function SummaryTab({ policy, open, openDoc }: { policy: PolicyRecord; open: (dialog: Dialog) => void; openDoc: (document: PolicyDocument) => void }) {
  const { state, engine } = useQuote();
  const day = state.simDate;
  const next = engine.nextInstallment(policy);
  const latest = (type: PolicyDocument['type']) => [...policy.documents].reverse().find((entry) => entry.type === type);
  return <div className="flex items-start gap-[20px]">
    <div className="w-[540px] shrink-0 space-y-[20px]">
      <WizardCard title="Policy Information" split={false}>
        <WizardRow label="Policy Number" value={policy.policyNumber} />
        <WizardRow label="Product" value={policy.productName} />
        <WizardRow label="Status" value={<StatusBadge status={policy.status} />} />
        <WizardRow label="Policy Period" value={`${policy.effectiveDate} – ${policy.expirationDate}`} />
        <WizardRow label="Term" value={`${policy.termNumber} (${policy.termMonths} months)`} />
        <WizardRow label="Term Premium" value={formatCurrency(policy.termPremium)} />
        <WizardRow label="Bill Plan" value={`${policy.billPlanName}${policy.autopay ? ' (automatic payments)' : ''}`} />
        <WizardRow label="Balance" value={formatCurrency(engine.balance(policy))} />
        <WizardRow label="Next Payment" value={next && policy.status !== 'Cancelled' ? `${formatCurrency(next.amount - next.paid)} due ${next.due}` : '—'} />
        <WizardRow label="Minimum Due Now" strong value={formatCurrency(engine.minimumDue(policy, day))} />
        <WizardRow label="Agent" value={`${policy.agentName} · ${policy.agentCode}`} />
      </WizardCard>
      <WizardCard title="Named Insured" split={false}>
        <WizardRow label="Name" value={policy.insured.name} />
        <WizardRow label="Mailing Address" value={`${policy.insured.street}, ${policy.insured.cityStateZip}`} />
        <WizardRow label="Phone / Email" value={`${policy.insured.phone} · ${policy.insured.email || '—'}`} />
        {policy.drivers.length > 0 && <WizardRow label="Rated Drivers/Operators" value={policy.drivers.join(', ')} />}
      </WizardCard>
    </div>
    <div className="w-[540px] shrink-0 space-y-[20px]">
      <WizardCard title="Coverages" split={false}>
        <div className="space-y-3 px-[21px] py-[12px] text-[13px]">{policy.units.map((unit, index) => <div key={index}><div className="font-bold">{unit.label} <span className="font-normal text-[#5c6670]">{unit.idNumber}</span></div><ul className="mt-1 space-y-0.5">{unit.coverages.map((line) => <li key={line.label} className="flex justify-between gap-3"><span>{line.label}: {line.value}</span><span className="tabular-nums text-[#5c6670]">{line.premium ? formatCurrency(line.premium) : ''}</span></li>)}</ul></div>)}
          {policy.discounts.length > 0 && <p className="border-t border-[#edf1f3] pt-2"><b>Discounts:</b> {policy.discounts.join(', ')}</p>}
          {policy.policyCoverages.length > 0 && <ul className="border-t border-[#edf1f3] pt-2">{policy.policyCoverages.map((line) => <li key={line.label} className="flex justify-between gap-3"><span>{line.label}: {line.value}</span><span className="tabular-nums text-[#5c6670]">{line.premium ? formatCurrency(line.premium) : ''}</span></li>)}</ul>}
        </div>
      </WizardCard>
      <WizardCard title="Quick Documents" split={false}>
        <div className="flex flex-wrap gap-[10px] px-[21px] py-[14px]">{(['Declarations', 'ID Cards', 'FS-1 Certificate of Insurance', 'Application'] as const).map((type) => { const found = latest(type); return found ? <button key={type} type="button" onClick={() => openDoc(found)} className={outlineButton}><FileText size={15} />{DOCUMENT_TITLES[type].replace('Insurance Identification Cards', 'ID Cards').replace(' Certification of Liability Insurance', '')}</button> : null; })}</div>
      </WizardCard>
      {policy.status === 'Active' && state.trainerMode && <WizardCard title="Trainer Tools" split={false}><div className="flex flex-wrap gap-[10px] px-[21px] py-[14px]"><button type="button" onClick={() => open('nonrenew')} className={outlineButton}>Non-Renew Policy</button></div></WizardCard>}
    </div>
  </div>;
}

function BillingTab({ policy, open }: { policy: PolicyRecord; open: (dialog: Dialog) => void }) {
  const { state, engine, servicePolicy } = useQuote();
  const [notice, setNotice] = useState('');
  const cell = 'border-b border-[#edf1f3] px-[14px] py-[9px] text-left';
  const tone: Record<string, string> = { paid: 'text-[#0b5d3f]', 'past due': 'font-bold text-[#c8102e]', billed: 'text-[#0073cf]', void: 'text-[#9aa6ae] line-through', scheduled: 'text-[#5c6670]' };
  const nsf = () => { if (!window.confirm('Simulate the bank returning the most recent payment (NSF)? This charges a returned payment fee and issues a notice of cancellation.')) return; const result = servicePolicy(policy.id, (record, today) => engine.returnedPayment(record, today)); setNotice(result || 'Payment returned. Notice of cancellation issued.'); };
  const open1 = policy.status === 'Active' || policy.status === 'Pending Cancel';
  return <div className="w-[1100px] space-y-[20px]">
    <WizardCard title="Billing Account" split={false} subtitle={<span className="flex gap-[10px]">{open1 && <button type="button" onClick={() => open('pay')} className={solidButton}>Make a Payment</button>}{policy.status === 'Active' && <button type="button" onClick={() => open('billplan')} className={outlineButton}>Change Bill Plan</button>}</span>}>
      <div className="grid grid-cols-5 gap-4 px-[21px] py-[16px] text-[14px]">{[['Term premium', policy.termPremium], ['Balance', engine.balance(policy)], ['Fees due', policy.feesDue], ['Past due', engine.pastDue(policy, state.simDate)], ['Minimum due now', engine.minimumDue(policy, state.simDate)]].map(([label, value]) => <div key={label as string}><div className="text-[11px] font-bold uppercase tracking-[.3px] text-[#5c6670]">{label}</div><div className="text-[18px] font-bold">{formatCurrency(value as number)}</div></div>)}</div>
      <p className="px-[21px] pb-[12px] text-[13px] text-[#5c6670]">{policy.billPlanName} · {policy.paymentMethod}{policy.autopay ? ' · payments draft automatically on the due date' : ` · payments more than ${engine.LATE_AFTER_DAYS} days late are charged a ${formatCurrency(engine.LATE_FEE)} late fee`}</p>
    </WizardCard>
    <WizardCard title="Installment Schedule" split={false}>
      <table className="w-full border-collapse text-[14px]"><thead><tr className="text-[12px] uppercase tracking-[.3px] text-[#5c6670]"><th className={cell}>#</th><th className={cell}>Due Date</th><th className={`${cell} text-right`}>Amount</th><th className={`${cell} text-right`}>Paid</th><th className={cell}>Status</th><th className={cell}>Billed</th></tr></thead><tbody>{policy.installments.map((entry) => <tr key={entry.id}><td className={cell}>{entry.number === 0 ? 'Down' : entry.number}</td><td className={cell}>{entry.due}</td><td className={`${cell} text-right tabular-nums`}>{formatCurrency(entry.amount)}</td><td className={`${cell} text-right tabular-nums`}>{formatCurrency(entry.paid)}</td><td className={`${cell} capitalize ${tone[entry.status]}`}>{entry.status}{entry.lateFeeApplied ? ' · late fee' : ''}</td><td className={cell}>{entry.billedOn || '—'}</td></tr>)}</tbody></table>
    </WizardCard>
    <WizardCard title="Transactions" split={false} subtitle={policy.ledger.some((entry) => entry.type === 'Payment' || entry.type === 'Automatic Payment') && open1 && state.trainerMode ? <button type="button" onClick={nsf} className={dangerButton}><RotateCcw size={14} />Simulate Returned Payment</button> : undefined}>
      <table className="w-full border-collapse text-[14px]"><thead><tr className="text-[12px] uppercase tracking-[.3px] text-[#5c6670]"><th className={cell}>Date</th><th className={cell}>Type</th><th className={cell}>Detail</th><th className={`${cell} text-right`}>Amount</th></tr></thead><tbody>{[...policy.ledger].reverse().map((entry) => <tr key={entry.id}><td className={cell}>{entry.date}</td><td className={cell}>{entry.type}</td><td className={`${cell} text-[13px] text-[#5c6670]`}>{entry.detail}</td><td className={`${cell} text-right tabular-nums ${entry.amount < 0 ? 'text-[#0b5d3f]' : ''}`}>{entry.amount < 0 ? `−${formatCurrency(-entry.amount)}` : formatCurrency(entry.amount)}</td></tr>)}</tbody></table>
    </WizardCard>
    {notice && <p role="status" className="text-[13px] font-medium text-[#c8102e]">{notice}</p>}
  </div>;
}

function DocumentsTab({ policy, openDoc }: { policy: PolicyRecord; openDoc: (document: PolicyDocument) => void }) {
  const cell = 'border-b border-[#edf1f3] px-[14px] py-[10px] text-left';
  return <div className="w-[1100px] space-y-[20px]"><WizardCard title="Policy Packet & Declarations" split={false}><div className="px-[21px] py-[14px]"><p className="mb-3 text-[13px] text-[#5c6670]">Download the current Declarations Page or a complete policy packet as a PDF. Each packet includes the declarations{['auto', 'motorcycle', 'motorhome', 'trailer', 'commercialAuto'].includes(policy.product) ? ', ID cards' : ''} and the application summary.</p><PacketButtons policy={policy} /></div></WizardCard><WizardCard title="Documents & Downloads" split={false} className="w-[1100px]" subtitle={<span className="text-[13px] font-medium">{policy.documents.length} documents</span>}>
    <table className="w-full border-collapse text-[14px]"><thead><tr className="text-[12px] uppercase tracking-[.3px] text-[#5c6670]"><th className={cell}>Date</th><th className={cell}>Document</th><th className={cell}>Term</th><th className={cell} /></tr></thead><tbody>{[...policy.documents].reverse().map((entry) => <tr key={entry.id} className="hover:bg-[#f6f9fb]"><td className={cell}>{entry.date}</td><td className={cell}><span className="flex items-center gap-2"><FileText size={16} className="text-[#003865]" />{DOCUMENT_TITLES[entry.type]}</span></td><td className={cell}>{entry.term}</td><td className={`${cell} text-right`}><button type="button" onClick={() => openDoc(entry)} className="font-bold text-[#0073cf] underline underline-offset-2">View / Print</button></td></tr>)}</tbody></table>
  </WizardCard></div>;
}

function HistoryTab({ policy }: { policy: PolicyRecord }) {
  const cell = 'border-b border-[#edf1f3] px-[14px] py-[10px] text-left align-top';
  return <WizardCard title="Policy History" split={false} className="w-[1100px]">
    <table className="w-full border-collapse text-[14px]"><thead><tr className="text-[12px] uppercase tracking-[.3px] text-[#5c6670]"><th className={cell}>Date</th><th className={cell}>Event</th><th className={cell}>Detail</th></tr></thead><tbody>{[...policy.history].reverse().map((entry) => <tr key={entry.id}><td className={`${cell} whitespace-nowrap`}>{entry.date}</td><td className={`${cell} font-medium`}>{entry.event}</td><td className={`${cell} text-[13px] text-[#5c6670]`}>{entry.detail}</td></tr>)}</tbody></table>
  </WizardCard>;
}

export function PolicyView() {
  const { state, setPolicyTab, openPolicies, servicePolicy, engine, lastConfirmation } = useQuote();
  const policy = state.policies.find((entry) => entry.id === state.ui.policyId);
  const intent = state.ui.policyIntent;
  const [dialog, setDialog] = useState<Dialog>(() => (intent && policy?.status === 'Active' ? 'change' : null));
  const [document, setDocument] = useState<PolicyDocument | null>(null);
  const [message, setMessage] = useState('');
  if (!policy) return <ServiceLayout back={{ label: 'Policy Search', onClick: () => openPolicies(state.ui.policyQuery) }}><p className="text-[14px]">Policy not found.</p></ServiceLayout>;
  const tab = state.ui.policyTab;
  const close = (text?: string) => { setDialog(null); if (text) setMessage(`${text} Confirmation #${lastConfirmation()}.`); };
  const renewal = policy.renewal;
  const reinstatement = engine.reinstatementCheck(policy, state.simDate);
  const nav = <aside className="w-[200px] shrink-0 border-r border-[#d0d8de] bg-white pt-[10px] print:hidden"><ol>{TABS.map(([key, label]) => <li key={key} className={`relative ${tab === key ? 'border-y border-[#d0d8de] before:absolute before:-bottom-px before:-top-px before:left-0 before:w-[4px] before:bg-[#003865]' : ''}`}><button type="button" onClick={() => setPolicyTab(key)} className={`block w-full py-[12px] pl-[25px] pr-[16px] text-left text-[12.5px] font-bold uppercase ${tab === key ? 'text-[#003865]' : 'text-[#003865] underline underline-offset-2 hover:text-[#0073cf]'}`}>{label}</button></li>)}</ol></aside>;

  return <ServiceLayout customer={{ name: policy.insured.name, phone: policy.insured.phone, email: policy.insured.email }} nav={nav} back={{ label: 'Policy Search', onClick: () => openPolicies(state.ui.policyQuery) }}>
    <TrainingClock />
    <div className="mb-[18px] flex w-[1100px] items-start justify-between">
      <div className="relative flex h-[60px] min-w-[176px] flex-col items-center justify-center bg-[#003865] px-[14px] text-white"><div className="text-[15px] font-bold leading-[19px]">{productTab(policy.product)}</div><div className="text-[13px] leading-[17px]">Policy #: {policy.policyNumber}</div><span className="absolute -bottom-[9px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[9px] border-x-transparent border-t-[#003865]" /></div>
      <div className="flex flex-wrap justify-end gap-[10px]">
        {(policy.status === 'Active' || policy.status === 'Pending Cancel') && <button type="button" onClick={() => setDialog('pay')} className={solidButton}>Make a Payment</button>}
        {policy.status === 'Active' && policy.source && <button type="button" onClick={() => setDialog('change')} className={solidButton}>Change Policy</button>}
        {policy.status === 'Active' && <button type="button" onClick={() => setDialog('cancel')} className={dangerButton}>Cancel Policy</button>}
        {policy.status === 'Cancelled' && reinstatement.allowed && <button type="button" onClick={() => setDialog('reinstate')} className={solidButton}>Reinstate Policy</button>}
      </div>
    </div>
    {message && <Alert tone="green" icon={<CheckCircle2 size={18} className="mt-px shrink-0 text-[#0f7a52]" />}><span className="flex justify-between">{message}<button type="button" onClick={() => setMessage('')} className="text-[13px] underline">Dismiss</button></span></Alert>}
    {policy.pendingCancel && <Alert tone="red" icon={<AlertTriangle size={18} className="mt-px shrink-0 text-[#c8102e]" />}><b>Pending cancellation</b> effective {policy.pendingCancel.effectiveDate}: {policy.pendingCancel.reason}.{policy.pendingCancel.kind === 'nonpayment' && <> Pay <b>{formatCurrency(engine.minimumDue(policy, state.simDate))}</b> before {policy.pendingCancel.effectiveDate} to rescind the cancellation. <button type="button" onClick={() => setDialog('pay')} className="font-bold underline">Make a Payment</button></>}</Alert>}
    {policy.status === 'Cancelled' && policy.cancellation && <Alert tone="grey" icon={<Info size={18} className="mt-px shrink-0" />}><b>Cancelled</b> effective {policy.cancellation.effectiveDate} ({policy.cancellation.reason}, {policy.cancellation.method}). {policy.cancellation.refund > 0 ? `Refund issued: ${formatCurrency(policy.cancellation.refund)}.` : policy.cancellation.balanceDue > 0 ? `Earned premium due: ${formatCurrency(policy.cancellation.balanceDue)}.` : ''} {reinstatement.allowed ? <>Reinstatement available until {engine.shiftDate(policy.cancellation.effectiveDate, engine.REINSTATEMENT_WINDOW_DAYS)}. <button type="button" onClick={() => setDialog('reinstate')} className="font-bold underline">Reinstate</button></> : reinstatement.reason}</Alert>}
    {policy.lapse && <Alert tone="amber" icon={<AlertTriangle size={18} className="mt-px shrink-0 text-[#e87722]" />}>Lapse in coverage from {policy.lapse.from} through {policy.lapse.to} (policy reinstated after the cancellation date).</Alert>}
    {renewal && <Alert tone="blue" icon={<Info size={18} className="mt-px shrink-0 text-[#0073cf]" />}><b>Renewal {renewal.status === 'Accepted' ? 'accepted' : 'offered'}</b> for {renewal.effectiveDate} – {renewal.expirationDate}: {formatCurrency(renewal.premium)} ({renewal.billPlanName}; current term {formatCurrency(renewal.previousPremium)}). {renewal.status === 'Offered' ? <>Down payment of <b>{formatCurrency(renewal.dueToday)}</b> is due by {renewal.effectiveDate}. <button type="button" onClick={() => setDialog('renewalPay')} className="font-bold underline">Pay Renewal</button> · <button type="button" onClick={() => { const result = servicePolicy(policy.id, (record, today) => engine.declineRenewal(record, today)); setMessage(result || 'Renewal declined. The policy will expire at the end of the term.'); }} className="font-bold underline">Decline Renewal</button></> : policy.autopay ? 'It renews automatically with the first payment drafted on the renewal date.' : 'The renewal down payment has been received.'}</Alert>}
    {policy.nonRenewal && <Alert tone="amber" icon={<AlertTriangle size={18} className="mt-px shrink-0 text-[#e87722]" />}><b>Non-renewal</b> ({policy.nonRenewal.by === 'company' ? 'company' : 'insured request'}): {policy.nonRenewal.reason}. Coverage ends {policy.expirationDate}.</Alert>}
    {policy.esign === 'Pending' && policy.status !== 'Cancelled' && <Alert tone="amber" icon={<FileText size={18} className="mt-px shrink-0 text-[#e87722]" />}><b>e-Sign follow-up required:</b> the application has not been signed. <button type="button" onClick={() => { servicePolicy(policy.id, (record, today) => engine.markSigned(record, today)); setMessage('Application marked as e-signed.'); }} className="font-bold underline">Mark as signed (customer completed e-Sign)</button></Alert>}
    {tab === 'summary' && <SummaryTab policy={policy} open={setDialog} openDoc={setDocument} />}
    {tab === 'billing' && <BillingTab policy={policy} open={setDialog} />}
    {tab === 'documents' && <DocumentsTab policy={policy} openDoc={setDocument} />}
    {tab === 'history' && <HistoryTab policy={policy} />}
    {dialog === 'pay' && <PaymentModal policy={policy} onClose={close} />}
    {dialog === 'renewalPay' && renewal && <PaymentModal policy={policy} preset={renewal.dueToday} onClose={close} />}
    {dialog === 'cancel' && <CancelModal policy={policy} onClose={close} />}
    {dialog === 'reinstate' && <ReinstateModal policy={policy} onClose={close} />}
    {dialog === 'billplan' && <BillPlanModal policy={policy} onClose={close} />}
    {dialog === 'nonrenew' && <NonRenewModal policy={policy} onClose={close} />}
    {dialog === 'change' && <ChangePolicyModal policy={policy} onClose={close} initialType={intent === 'address' || intent === 'addVehicle' || intent === 'removeVehicle' ? intent : undefined} />}
    {document && <DocumentPreview policy={policy} document={document} onClose={() => setDocument(null)} />}
  </ServiceLayout>;
}
