// Manage Automatic Payments: agent verification, then the new card or bank account, then
// confirmation. Full card and account numbers live only in this form's state; the policy keeps the
// last four digits.
import { useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { PolicyRecord } from '@/types/policy';
import { useQuote } from '@/context/useQuote';
import { runWithSpinner } from '@/services/processing';
import { SAVED_TEXT, paymentAccountOf, savedFor, updateAutopayBank, updateAutopayCard, type AutopayMode, type Verification } from '@/services/autopay';
import { productLabel } from '@/products/configs';
import { EMAIL } from '@/utils/validation';
import { bankProblem, cardBrand, cardProblem, formatCardNumber, formatExpiry, maskCard, type CardBrand } from '@/utils/cards';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';

const focus = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';
const input = 'h-[36px] rounded-[3px] border border-[#8b98a3] bg-white px-[10px] text-[13px] text-[#1f2a33] outline-none focus:border-[#0073cf] focus:shadow-[0_0_0_1px_#0073cf]';
const fieldLabel = 'block text-[13px] font-bold text-[#1f2a33]';
const sectionTitle = 'text-[16px] font-medium text-[#2f4a66]';
const REQUESTERS = ['Agent', 'Policyholder', 'Spouse', 'Authorized User'];

function Field({ label, optional, help, children }: { label: string; optional?: boolean; help?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-[22px]">
    <div className={fieldLabel}>{label}{help && <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`ml-[6px] text-[11.5px] font-normal text-[#0073cf] underline ${focus}`}>Help</button>}{optional && <span className="ml-[4px] text-[11px] font-normal text-[#5c6670]">(Optional)</span>}</div>
    {open && help && <p className="mt-[4px] max-w-[420px] rounded-[3px] bg-[#eef5fb] px-[10px] py-[6px] text-[12px] text-[#2f4a66]">{help}</p>}
    <div className="mt-[6px]">{children}</div>
  </div>;
}

/** A select drawn like the carrier's: white box with a separate chevron cell on the right. */
function Select({ label, value, options, onChange, width }: { label: string; value: string; options: string[]; onChange: (value: string) => void; width: string }) {
  return <span className={`relative inline-block ${width}`}>
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={`${input} w-full appearance-none pr-[40px]`}><option value="" />{options.map((option) => <option key={option}>{option}</option>)}</select>
    <span className="pointer-events-none absolute inset-y-[1px] right-[1px] flex w-[28px] items-center justify-center rounded-r-[3px] border-l border-[#8b98a3] bg-white text-[#0073cf]"><ChevronDown size={15} /></span>
  </span>;
}

/** Small brand marks inside the card number field; the detected brand stays in full color. */
function BrandMarks({ brand }: { brand: CardBrand | null }) {
  const mark = (name: CardBrand, body: ReactNode) => <span key={name} title={name} className={`flex h-[18px] w-[30px] items-center justify-center rounded-[2px] border border-[#d0d7de] bg-white ${brand && brand !== name ? 'opacity-30' : ''}`}>{body}</span>;
  return <span className="pointer-events-none absolute right-[8px] top-1/2 flex -translate-y-1/2 gap-[4px]" aria-hidden>
    {mark('Visa', <span className="text-[8.5px] font-black italic tracking-[-.3px] text-[#1a1f71]">VISA</span>)}
    {mark('Mastercard', <svg viewBox="0 0 24 14" className="h-[12px] w-[20px]"><circle cx="9" cy="7" r="6" fill="#eb001b" /><circle cx="15" cy="7" r="6" fill="#f79e1b" fillOpacity=".9" /></svg>)}
    {mark('Discover', <span className="text-[6.5px] font-bold tracking-[-.2px] text-[#231f20]">DISC<span className="text-[#f76f20]">●</span>VER</span>)}
  </span>;
}

function Actions({ onCancel }: { onCancel: () => void }) {
  return <div className="mt-[30px] flex items-center gap-[40px]"><button type="submit" className={`h-[46px] w-[226px] rounded-[3px] bg-[#0073cf] text-[13px] font-bold text-white hover:bg-[#0056b3] ${focus}`}>Continue</button><button type="button" onClick={onCancel} className={`text-[13px] text-[#1f2a33] hover:underline ${focus}`}>Cancel</button></div>;
}

const Problem = ({ text }: { text: string }) => (text ? <p role="alert" className="mt-[14px] text-[13px] text-[#9e0012]">{text}</p> : null);

export function AutoPayFlow({ policy, mode, onCancel, onDone }: { policy: PolicyRecord; mode: AutopayMode; onCancel: () => void; onDone: (message: string) => void }) {
  const { state, servicePolicy, lastConfirmation } = useQuote();
  const [step, setStep] = useState<'verify' | 'method' | 'form' | 'done'>('verify');
  const [kind, setKind] = useState<'card' | 'bank' | ''>(mode === 'enroll' ? '' : mode);
  const [verify, setVerify] = useState<Verification>({ agentName: '', requester: '', email: policy.insured.email, agentEmail: '' });
  const [card, setCard] = useState({ name: '', number: '', expiry: '' });
  const [bank, setBank] = useState({ type: '', name: '', routing: '', account: '', confirm: '' });
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const current = paymentAccountOf(policy);
  const brand = cardBrand(card.number);
  const agentEmails = [`${state.agent.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@${state.agent.agencyName.toLowerCase().replace(/[^a-z]+/g, '')}.example.com`];

  const continueVerify = () => {
    if (!verify.agentName.trim()) { setError('Enter the agent name.'); return; }
    if (!verify.requester) { setError('Select who requested the change.'); return; }
    if (verify.email.trim() && !EMAIL.test(verify.email.trim())) { setError("Enter a valid policyholder's email or leave it blank."); return; }
    if (verify.agentEmail.trim() && !EMAIL.test(verify.agentEmail.trim())) { setError('Enter a valid agent email or leave it blank.'); return; }
    setError('');
    setStep(mode === 'enroll' ? 'method' : 'form');
  };
  const continueMethod = () => {
    if (!kind) { setError('Select how the customer will pay.'); return; }
    setError('');
    setStep('form');
  };
  const save = () => {
    const problem = kind === 'card' ? cardProblem(card, state.simDate) : bankProblem(bank);
    if (problem) { setError(problem); return; }
    setError('');
    runWithSpinner('Updating automatic payments...', () => {
      const failure = servicePolicy(policy.id, (record, day) => (kind === 'card' ? updateAutopayCard(record, { ...card, ...verify }, day) : updateAutopayBank(record, { ...bank, ...verify }, day)));
      if (failure) { setError(failure); return; }
      const what = kind === 'card' ? `${cardBrand(card.number)} ending in ${card.number.replace(/\D/g, '').slice(-4)} (exp ${card.expiry})` : `${bank.type} account ending in ${bank.account.replace(/\D/g, '').slice(-4)}`;
      setResult(`${what} ${SAVED_TEXT[savedFor(policy)]}. Confirmation #${lastConfirmation()}.`);
      setCard({ name: '', number: '', expiry: '' });
      setBank({ type: '', name: '', routing: '', account: '', confirm: '' });
      setStep('done');
    }, 1200);
  };
  const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

  return <div className="mx-auto w-full max-w-[900px] px-[32px] pb-[40px] pt-[22px]">
    <nav aria-label="Breadcrumb" className="flex items-center gap-[4px] text-[12px]"><button type="button" onClick={onCancel} className={`font-medium text-[#0073cf] hover:underline ${focus}`}>Policy and Coverages</button><ChevronRight size={13} className="text-[#7b858a]" /><span className="text-[#5c6670]">Manage Automatic Payments</span></nav>
    <header className="mt-[8px] text-center"><h1 className="text-[30px] font-bold tracking-[-.4px] text-[#2f4a66]">Manage Automatic Payments</h1><p className="mt-[2px] text-[15px] text-[#5c6670]">{productLabel(policy.product)} {policy.policyNumber}</p></header>

    <section className="mt-[22px] max-w-[640px] rounded-[4px] border border-[#d0d7de] bg-white px-[32px] pb-[30px] pt-[24px]">
      {step === 'verify' && <form onSubmit={(event) => { event.preventDefault(); continueVerify(); }} noValidate>
        <p className="text-[12.5px] italic text-[#3d4b55]">All fields are required unless marked as optional.</p>
        <div className="mt-[18px]"><div className={fieldLabel}>Date to update Automatic Payments</div><div className="mt-[4px] text-[13px] text-[#3d4b55]">{state.simDate}</div></div>
        <Field label="Agent name"><input aria-label="Agent name" value={verify.agentName} onChange={(event) => setVerify({ ...verify, agentName: event.target.value })} className={`${input} w-[300px]`} /></Field>
        <Field label="Requester"><Select label="Requester" value={verify.requester} options={REQUESTERS} onChange={(requester) => setVerify({ ...verify, requester })} width="w-[300px]" /></Field>
        <h2 className={`${sectionTitle} mt-[28px]`}>Policyholder&rsquo;s email</h2>
        <p className="mt-[6px] text-[12.5px] font-bold text-[#1f2a33]">Confirm the policyholder&rsquo;s email address below.</p>
        <p className="text-[12.5px] text-[#3d4b55]">Any changes you make (including deletion) will be saved to the policy.</p>
        <Field label="Email" optional help="The automatic payment confirmation is emailed here. Leave blank if the policyholder has no email."><input aria-label="Email" type="email" value={verify.email} onChange={(event) => setVerify({ ...verify, email: event.target.value })} className={`${input} w-[360px]`} /></Field>
        <h2 className={`${sectionTitle} mt-[28px]`}>Agent confirmation email</h2>
        <p className="mt-[6px] text-[12.5px] text-[#3d4b55]">To receive a copy of the confirmation email sent to the policyholder, please select or enter your email address below.</p>
        <Field label="Agent email" optional><span className="relative inline-block w-[240px]"><input aria-label="Agent email" type="email" list="agent-emails" value={verify.agentEmail} onChange={(event) => setVerify({ ...verify, agentEmail: event.target.value })} className={`${input} w-full pr-[40px]`} /><span className="pointer-events-none absolute inset-y-[1px] right-[1px] flex w-[28px] items-center justify-center rounded-r-[3px] border-l border-[#8b98a3] bg-white text-[#0073cf]"><ChevronDown size={15} /></span></span><datalist id="agent-emails">{agentEmails.map((email) => <option key={email} value={email} />)}</datalist></Field>
        <Problem text={error} />
        <Actions onCancel={onCancel} />
      </form>}

      {step === 'method' && <form onSubmit={(event) => { event.preventDefault(); continueMethod(); }} noValidate>
        <h2 className={sectionTitle}>How will the customer pay?</h2>
        <p className="mt-[6px] text-[12.5px] text-[#3d4b55]">Automatic payments draft on each due date. {policy.billPlanId === 'PIF' ? 'This policy is paid in full, so the account is used for renewal payments.' : 'The remaining installments move to the matching automatic bill plan, which has a lower installment fee than Pay by Mail.'}</p>
        <fieldset className="mt-[16px] space-y-[10px]"><legend className="sr-only">Payment type</legend>{([['card', 'Credit or debit card', 'Visa, Mastercard or Discover'], ['bank', 'Bank account (EFT)', 'Checking or savings account']] as const).map(([value, title, note]) => <label key={value} className="flex items-start gap-[10px] rounded-[3px] border border-[#d0d7de] px-[14px] py-[10px] text-[13px]"><input type="radio" name="autopay-kind" checked={kind === value} onChange={() => setKind(value)} className="mt-[2px] h-[18px] w-[18px] accent-[#0073cf]" /><span><b>{title}</b><span className="block text-[12px] text-[#5c6670]">{note}</span></span></label>)}</fieldset>
        <Problem text={error} />
        <Actions onCancel={onCancel} />
      </form>}

      {step !== 'verify' && step !== 'method' && kind === 'card' && <form onSubmit={(event) => { event.preventDefault(); save(); }} noValidate autoComplete="off">
        <div role="note" className="flex items-start gap-[8px] rounded-[4px] border border-[#f5a623] bg-[#fff8e1] px-[14px] py-[10px] text-[12.5px] text-[#1f2a33]"><Info size={16} className="mt-px shrink-0 fill-[#f57c00] text-white" />You need to have card authorization from the card holder before completing this form.</div>
        {mode !== 'enroll' && <>
          <h2 className={`${sectionTitle} mt-[20px]`}>Current card information</h2>
          <div className="mt-[10px] text-[12.5px] font-bold text-[#1f2a33]">Card number</div>
          <div className="text-[12.5px] text-[#3d4b55]">{current?.kind === 'card' ? maskCard(current.last4) : 'No card on file'}</div>
          <div className="mt-[10px] text-[12.5px] font-bold text-[#1f2a33]">Expiration date</div>
          <div className="min-h-[18px] text-[12.5px] text-[#3d4b55]">{current?.kind === 'card' ? current.expiry ?? '' : ''}</div>
        </>}
        <h2 className={`${sectionTitle} mt-[22px]`}>Add your credit or debit card information</h2>
        <p className="mt-[4px] text-[12.5px] text-[#3d4b55]">We accept Visa, Mastercard and Discover.</p>
        <Field label="Name on the card"><input aria-label="Name on the card" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value.slice(0, 60) })} autoComplete="off" className={`${input} w-[228px]`} /></Field>
        <Field label="Card number"><span className="relative inline-block"><input aria-label="Card number" inputMode="numeric" value={card.number} onChange={(event) => setCard({ ...card, number: formatCardNumber(event.target.value) })} autoComplete="off" className={`${input} w-[210px] pr-[112px] tabular-nums sm:w-[300px]`} /><BrandMarks brand={brand} /></span></Field>
        <Field label="Expiration date"><input aria-label="Expiration date" inputMode="numeric" placeholder="mm/yy" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: formatExpiry(event.target.value) })} autoComplete="off" className={`${input} w-[64px] font-mono`} /></Field>
        <p className="mt-[16px] text-[11.5px] text-[#5c6670]">Training simulation: never enter a real card. Use a test number such as Visa 4111 1111 1111 1111, Mastercard 5555 5555 5555 4444 or Discover 6011 1111 1111 1117. Only the last four digits are saved.</p>
        <Problem text={error} />
        <Actions onCancel={onCancel} />
      </form>}

      {step !== 'verify' && step !== 'method' && kind === 'bank' && <form onSubmit={(event) => { event.preventDefault(); save(); }} noValidate autoComplete="off">
        <div role="note" className="flex items-start gap-[8px] rounded-[4px] border border-[#f5a623] bg-[#fff8e1] px-[14px] py-[10px] text-[12.5px] text-[#1f2a33]"><Info size={16} className="mt-px shrink-0 fill-[#f57c00] text-white" />You need to have authorization from the account holder before completing this form.</div>
        {mode !== 'enroll' && <>
          <h2 className={`${sectionTitle} mt-[20px]`}>Current bank account information</h2>
          <div className="mt-[10px] text-[12.5px] font-bold text-[#1f2a33]">Account type</div>
          <div className="text-[12.5px] text-[#3d4b55]">{current?.kind === 'bank' ? current.brand : '—'}</div>
          <div className="mt-[10px] text-[12.5px] font-bold text-[#1f2a33]">Account number</div>
          <div className="text-[12.5px] text-[#3d4b55]">{current?.kind === 'bank' ? `******${current.last4}` : '—'}</div>
        </>}
        <h2 className={`${sectionTitle} mt-[22px]`}>Add your bank account information</h2>
        <p className="mt-[4px] text-[12.5px] text-[#3d4b55]">We accept checking and savings accounts at U.S. banks.</p>
        <Field label="Account type"><Select label="Account type" value={bank.type} options={['Checking', 'Savings']} onChange={(type) => setBank({ ...bank, type })} width="w-[228px]" /></Field>
        <Field label="Name on the account"><input aria-label="Name on the account" value={bank.name} onChange={(event) => setBank({ ...bank, name: event.target.value.slice(0, 60) })} autoComplete="off" className={`${input} w-[228px]`} /></Field>
        <Field label="Routing number" help="The 9-digit number at the bottom left of a check."><input aria-label="Routing number" inputMode="numeric" value={bank.routing} onChange={(event) => setBank({ ...bank, routing: digits(event.target.value, 9) })} autoComplete="off" className={`${input} w-[160px] tabular-nums`} /></Field>
        <Field label="Account number"><input aria-label="Account number" inputMode="numeric" value={bank.account} onChange={(event) => setBank({ ...bank, account: digits(event.target.value, 17) })} autoComplete="off" className={`${input} w-[228px] tabular-nums`} /></Field>
        <Field label="Re-enter account number"><input aria-label="Re-enter account number" inputMode="numeric" value={bank.confirm} onChange={(event) => setBank({ ...bank, confirm: digits(event.target.value, 17) })} onPaste={(event) => event.preventDefault()} autoComplete="off" className={`${input} w-[228px] tabular-nums`} /></Field>
        <p className="mt-[16px] text-[11.5px] text-[#5c6670]">Training simulation: never enter a real bank account. Use test routing number 011000015 with any account number such as 000123456789. Only the last four digits are saved.</p>
        <Problem text={error} />
        <Actions onCancel={onCancel} />
      </form>}
    </section>

    {step === 'done' && <Modal title="Automatic Payment Method Updated" width={560} onClose={() => onDone(result)} footer={<button type="button" autoFocus className={modalButton.blue} onClick={() => onDone(result)}>Return to Policy and Coverages</button>}>
      <p className="flex items-start gap-[10px] text-[14px] leading-[20px]"><CheckCircle2 size={22} className="shrink-0 text-[#0f7a52]" /><span><b>Automatic Payment Method Updated Successfully.</b><br />{result}</span></p>
    </Modal>}
  </div>;
}
