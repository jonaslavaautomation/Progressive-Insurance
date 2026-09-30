// "ID Cards and Other Proof of Insurance": document hub, ID card Save/Print/Mail/Fax and
// Verification of Insurance for a lender, with the customer policy sidebar.
import { useState, type FormEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CircleHelp, Download, Mailbox, Printer, Search, Settings, TicketPercent } from 'lucide-react';
import type { PolicyDocument, PolicyRecord } from '@/types/policy';
import { useQuote } from '@/context/useQuote';
import { customerKey } from '@/servicing/policyFilters';
import { DocumentPreview } from '@/servicing/PolicyDocuments';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';
import { InlineError, SelectControl, TextControl } from '@/components/wizard/primitives';
import { PHONE } from '@/utils/validation';
import { POLICY_ICONS, customerSince, formatLongDate, hasIdCards, latestDocument, shortDate } from '@/servicing/portal/portalUtils';
import { downloadIdCards } from '@/servicing/portal/idCardImage';

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const withHistory = (policy: PolicyRecord, day: string, event: string, detail: string): PolicyRecord => ({ ...policy, history: [...policy.history, { id: newId('his'), date: day, event, detail }] });

function FaxIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="9" width="18" height="11" rx="2" /><path d="M7 9V3h8l2 2v4" /><path d="M7 13h2M11 13h2M15 13h2M7 16h2M11 16h2M15 16h2" /></svg>;
}

function Sidebar({ policy, collapsed, onToggle, largeText, onLargeText }: { policy: PolicyRecord; collapsed: boolean; onToggle: () => void; largeText: boolean; onLargeText: (value: boolean) => void }) {
  const { state, openProof, openPolicies, showDashboard, openCustomer } = useQuote();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [prefs, setPrefs] = useState(false);
  const Icon = POLICY_ICONS[policy.product];
  const since = customerSince(state.policies.filter((entry) => customerKey(entry) === customerKey(policy)));
  const find = (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim().toLowerCase();
    if (!text) { setError('Enter a name or policy number.'); return; }
    const matches = state.policies.filter((entry) => entry.policyNumber.includes(text) || entry.insured.name.toLowerCase().includes(text));
    if (matches.length === 1) { setError(''); openProof(matches[0].id); return; }
    if (!matches.length) { setError('No policies found.'); return; }
    openPolicies(/^\d+$/.test(text) ? { mode: 'Policy', policyNumber: text } : { mode: 'Customer', lastName: text.split(' ').pop() ?? text });
  };
  return <aside className={`relative flex shrink-0 flex-col border-r border-[#d5d9dd] bg-white transition-[width] print:hidden ${collapsed ? 'w-0' : 'w-[256px]'}`}>
    <button type="button" onClick={onToggle} aria-label={collapsed ? 'Show policy panel' : 'Hide policy panel'} className="absolute -right-[38px] top-[32px] z-10 flex h-[54px] w-[36px] items-center justify-center rounded-r-[6px] border border-l-0 border-[#d5d9dd] bg-white text-[#0073cf] hover:bg-[#e8f4fa]">{collapsed ? <ChevronRight size={26} /> : <ChevronLeft size={26} />}</button>
    {!collapsed && <>
      <button type="button" onClick={showDashboard} title="Return to dashboard" className="flex h-[82px] items-center justify-center bg-[#003865] text-[22px] font-light tracking-[-.5px] text-white">FOR<b className="font-bold">AGENTS</b>ONLY</button>
      <p className="mt-[24px] text-center text-[12px]">Customer since {since}</p>
      <form onSubmit={find} className="px-[26px] pt-[14px]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a name or policy #" aria-label="Enter a name or policy number" className="h-[44px] w-full rounded-[2px] border border-[#6b7780] px-[8px] text-[15px] outline-none focus:border-[#0073cf]" />
        <button type="submit" className="mt-[12px] flex h-[44px] w-full items-center justify-center gap-2 rounded-[2px] bg-[#0073cf] text-[15px] font-bold text-white hover:bg-[#003865]">Find Policy <Search size={15} /></button>
        {error && <InlineError message={error} />}
      </form>
      <div className="mt-[16px] flex gap-[14px] border-y border-[#d5d9dd] px-[18px] py-[14px]">
        <div className="flex w-[44px] flex-col items-center"><Icon size={32} strokeWidth={1.3} className="text-[#1d4f91]" /><span className="mt-1 text-[12px] text-[#0073cf]">Opened</span></div>
        <div className="min-w-0 text-[12px] leading-[20px]">
          <button type="button" onClick={() => openCustomer(customerKey(policy))} className="block text-left text-[15px] font-bold leading-[20px] hover:underline">{policy.insured.name}</button>
          <div className="border-b border-[#1b2a36] pb-[6px] text-[15px] font-bold">{policy.productName.replace(' (HO4)', '')} {policy.policyNumber}</div>
          <div className="mt-[6px]">{shortDate(policy.effectiveDate)} - {shortDate(policy.expirationDate)}</div>
          <div>Primary named insured</div>
          <div>{policy.status}, NC, {policy.agentCode.split(' ')[0]}</div>
        </div>
      </div>
      <button type="button" onClick={showDashboard} className="flex items-center gap-[14px] border-b border-[#d5d9dd] px-[20px] py-[14px] text-left text-[12px] hover:bg-[#f3f7fa]"><TicketPercent size={24} strokeWidth={1.3} className="text-[#0073cf]" />New Policy Quotes</button>
      <div className="mt-auto border-t border-[#d5d9dd]">
        {prefs && <label className="flex items-center gap-2 px-[20px] pt-[12px] text-[12px]"><input type="checkbox" checked={largeText} onChange={(event) => onLargeText(event.target.checked)} className="h-[16px] w-[16px] accent-[#003865]" />Larger text</label>}
        <button type="button" onClick={() => setPrefs(!prefs)} className="flex w-full items-center gap-[14px] px-[20px] py-[14px] text-left text-[12px] hover:bg-[#f3f7fa]"><Settings size={22} strokeWidth={1.4} className="text-[#0073cf]" />Visual Preferences</button>
      </div>
    </>}
  </aside>;
}

function Footer() {
  return <footer className="mt-auto flex flex-wrap justify-between gap-4 px-[20px] pb-[20px] pt-[60px] text-[13px] text-[#3d4b55] print:hidden">
    <div className="space-y-[18px] font-medium"><a href="#" onClick={(event) => event.preventDefault()} className="block hover:underline">CA Notice at Collection</a><a href="#" onClick={(event) => event.preventDefault()} className="block hover:underline">Do Not Sell or Share My Personal Information (CA Residents Only)</a></div>
    <span>Copyright 1995 - {new Date().getFullYear()}. Progressive Casualty Insurance Company. Training simulation.</span>
  </footer>;
}

function DocumentOption({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center justify-between border-b border-[#d5d9dd] px-[22px] py-[18px] text-left last:border-b-0 hover:bg-[#f3f9fc] focus-visible:relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0073cf]">
    <span><span className="block text-[16px] font-medium text-[#0073cf]">{title}</span><span className="mt-[2px] block text-[12px] text-[#3d4b55]">{text}</span></span>
    <ChevronRight size={22} className="text-[#0073cf]" />
  </button>;
}

function Hub({ policy, onPreview }: { policy: PolicyRecord; onPreview: (document: PolicyDocument) => void }) {
  const { openProof } = useQuote();
  const declarations = latestDocument(policy, ['Declarations', 'Renewal Declarations', 'Amended Declarations']);
  return <>
    <h2 className="text-[14px] font-bold">ID Cards and Other Proof of Insurance</h2>
    <h1 className="mt-[4px] text-[32px] font-light leading-[40px]">Which document would you like to review?</h1>
    <div className="mt-[28px] rounded-[3px] border border-[#d5d9dd]">
      {hasIdCards(policy) && <DocumentOption title="ID Cards" text="View, send, or print your ID cards to keep in your car." onClick={() => openProof(policy.id, 'idcards')} />}
      <DocumentOption title="Verification of Insurance" text={policy.product === 'renters' ? 'Get proof of insurance for your landlord or property manager.' : 'Get proof of insurance for your lender or leasing company.'} onClick={() => openProof(policy.id, 'verification')} />
      {declarations && <DocumentOption title="Declarations Page" text="See a full summary of your coverages and policy details." onClick={() => onPreview(declarations)} />}
    </div>
  </>;
}

function SendModal({ policy, mode, onClose }: { policy: PolicyRecord; mode: 'mail' | 'fax'; onClose: (message?: string) => void }) {
  const { servicePolicy, lastConfirmation } = useQuote();
  const [to, setTo] = useState(mode === 'mail' ? 'insured' : '');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [fax, setFax] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (mode === 'fax') {
      if (!name.trim()) { setError('Enter who the fax is for.'); return; }
      if (!PHONE.test(fax)) { setError('Enter a valid 10-digit fax number (XXX-XXX-XXXX).'); return; }
      servicePolicy(policy.id, (record, day) => withHistory(record, day, 'ID cards faxed', `Faxed to ${name.trim()} at ${fax}.`));
      onClose(`ID cards faxed to ${name.trim()} at ${fax}. Confirmation #${lastConfirmation()}.`);
      return;
    }
    const destination = to === 'insured' ? `${policy.insured.name}, ${policy.insured.street}, ${policy.insured.cityStateZip}` : `${name.trim()}, ${address.trim()}`;
    if (to !== 'insured' && (!name.trim() || !address.trim())) { setError('Enter the recipient name and mailing address.'); return; }
    servicePolicy(policy.id, (record, day) => withHistory(record, day, 'ID cards mailed', `Mailed to ${destination}. Delivery in 5-7 business days.`));
    onClose(`ID cards will be mailed to ${destination} within 5-7 business days. Confirmation #${lastConfirmation()}.`);
  };
  return <Modal title={mode === 'mail' ? 'Mail ID Cards' : 'Fax ID Cards'} width={600} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.primary} onClick={submit}>{mode === 'mail' ? 'Mail ID Cards' : 'Send Fax'}</button></>}>
    <div className="space-y-3 text-[13px]">
      {mode === 'mail' && <label className="block"><span className="mb-1 block font-medium">Send to</span><SelectControl value={to} options={[{ value: 'insured', label: `Named insured's mailing address (${policy.insured.street}, ${policy.insured.cityStateZip})` }, { value: 'other', label: 'A different address' }]} onChange={setTo} /></label>}
      {(mode === 'fax' || to === 'other') && <label className="block"><span className="mb-1 block font-medium">{mode === 'fax' ? 'Attention (name or company)' : 'Recipient name'}</span><TextControl value={name} onChange={setName} /></label>}
      {mode === 'mail' && to === 'other' && <label className="block"><span className="mb-1 block font-medium">Mailing address</span><TextControl value={address} onChange={setAddress} /></label>}
      {mode === 'fax' && <label className="block"><span className="mb-1 block font-medium">Fax number</span><TextControl value={fax} mask="phone" onChange={setFax} placeholder="XXX-XXX-XXXX" /></label>}
      <p className="text-[12px] text-[#5c6670]">Cards for every vehicle on policy #{policy.policyNumber} are included. Training simulation: nothing is actually {mode === 'mail' ? 'mailed' : 'faxed'}; the request is recorded in the policy history.</p>
      <InlineError message={error} />
    </div>
  </Modal>;
}

function IdCardsPage({ policy, onPreview, onNotice }: { policy: PolicyRecord; onPreview: (document: PolicyDocument) => void; onNotice: (message: string) => void }) {
  const { state } = useQuote();
  const [send, setSend] = useState<'mail' | 'fax' | null>(null);
  const [help, setHelp] = useState(false);
  const Icon = POLICY_ICONS[policy.product];
  const cards = latestDocument(policy, ['ID Cards']);
  const action = (label: string, icon: ReactNode, onClick: () => void) => <button type="button" onClick={onClick} className="flex w-[84px] flex-col items-center gap-[4px] rounded-[6px] px-2 py-[10px] text-[15px] text-[#0073cf] hover:bg-[#e8f4fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e87722]">{icon}{label}</button>;
  const renewal = policy.renewal?.status === 'Accepted' ? policy.renewal : null;
  const period = (title: string, from: string, to: string) => <div className="flex flex-wrap items-center justify-between gap-4 px-[32px] py-[18px]">
    <div><div className="text-[20px] font-medium text-[#0073cf]">{title}</div><div className="text-[14px] text-[#3d4b55]">{formatLongDate(from)} - {formatLongDate(to)}</div></div>
    <div className="flex gap-[8px]">
      {action('Save', <Download size={26} strokeWidth={1.6} />, () => { downloadIdCards(policy, state.agent.agencyName); onNotice(`ID cards for policy #${policy.policyNumber} saved as a PNG image.`); })}
      {action('Print', <Printer size={26} strokeWidth={1.6} />, () => cards && onPreview(cards))}
      {action('Mail', <Mailbox size={26} strokeWidth={1.6} />, () => setSend('mail'))}
      {action('Fax', <FaxIcon />, () => setSend('fax'))}
    </div>
  </div>;
  return <>
    <h2 className="text-[16px] font-bold">ID Card</h2>
    <h1 className="mt-[4px] text-[38px] font-light leading-[46px]">Save, print, or send your ID Card.</h1>
    <fieldset className="mt-[26px] rounded-[2px] border border-[#cfd6db]">
      <legend className="ml-[26px] flex items-center gap-[12px] px-[8px] text-[16px] font-medium text-[#3d4b55]"><Icon size={32} strokeWidth={1.3} className="text-[#1d4f91]" />{policy.productName.replace(' (HO4)', '')} {policy.policyNumber}</legend>
      {period('Current Policy Period', policy.effectiveDate, policy.expirationDate)}
      {renewal && <div className="border-t border-[#e4ecf1]">{period('Upcoming Policy Period', renewal.effectiveDate, renewal.expirationDate)}</div>}
    </fieldset>
    <div className="relative mt-[40px] flex items-center justify-end gap-[12px] text-[16px] text-[#3d4b55]">Looking for a driver or vehicle?<button type="button" onClick={() => setHelp(!help)} aria-label="Help: looking for a driver or vehicle" className="text-[#7b1fa2]"><CircleHelp size={22} fill="#7b1fa2" className="text-white" /></button>
      {help && <div role="tooltip" className="absolute right-0 top-[34px] z-10 w-[360px] rounded-[3px] border border-[#cfd6db] bg-white p-3 text-[13px] shadow-lg">ID cards list every vehicle on the policy. If a vehicle is missing or was just added, use <b>Quote or Make Changes</b> on the Customer Summary; new cards are issued with the policy change.</div>}
    </div>
    {send && <SendModal policy={policy} mode={send} onClose={(message) => { setSend(null); if (message) onNotice(message); }} />}
  </>;
}

function VerificationPage({ policy, onPreview }: { policy: PolicyRecord; onPreview: (document: PolicyDocument) => void }) {
  const { servicePolicy, state } = useQuote();
  const renters = policy.product === 'renters';
  const [unit, setUnit] = useState(policy.units[0]?.label ?? policy.productName);
  const [kind, setKind] = useState<'Lienholder' | 'Lessor'>('Lienholder');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loan, setLoan] = useState('');
  const [error, setError] = useState('');
  const generate = () => {
    if (!name.trim() || !address.trim()) { setError(`Enter the ${renters ? 'landlord or property manager' : 'lender or leasing company'} name and address.`); return; }
    const document: PolicyDocument = { id: newId('doc'), type: 'Evidence of Insurance', date: state.simDate, term: policy.termNumber, data: { name: name.trim(), address: address.trim(), loanNumber: loan.trim(), unit, kind: renters ? 'Interested party' : kind } };
    const result = servicePolicy(policy.id, (record, day) => withHistory({ ...record, documents: [...record.documents, document] }, day, 'Verification of insurance issued', `Issued to ${name.trim()} for ${unit}.`));
    if (result) { setError(result); return; }
    onPreview(document);
  };
  const field = (label: string, control: ReactNode) => <label className="block text-[14px]"><span className="mb-1 block font-medium">{label}</span>{control}</label>;
  return <>
    <h2 className="text-[16px] font-bold">Verification of Insurance</h2>
    <h1 className="mt-[4px] text-[34px] font-light leading-[42px]">Who needs proof of insurance?</h1>
    <p className="mt-2 max-w-[760px] text-[14px] text-[#3d4b55]">We&rsquo;ll create a verification letter showing the coverage on this {renters ? 'policy' : 'vehicle'}. It opens ready to print, save as PDF or send to the {renters ? 'landlord' : 'lender or leasing company'}.</p>
    <div className="mt-6 grid max-w-[760px] grid-cols-2 gap-4">
      {!renters && field('Vehicle', <SelectControl value={unit} options={policy.units.map((entry) => entry.label)} onChange={setUnit} />)}
      {!renters && field('Interest', <SelectControl value={kind} options={['Lienholder', 'Lessor']} onChange={(value) => setKind(value as 'Lienholder' | 'Lessor')} />)}
      {field(renters ? 'Landlord / property manager' : 'Lender or leasing company', <TextControl value={name} onChange={setName} />)}
      {field('Mailing address', <TextControl value={address} onChange={setAddress} />)}
      {!renters && field('Loan or lease number (optional)', <TextControl value={loan} onChange={setLoan} />)}
    </div>
    <InlineError message={error} />
    <button type="button" onClick={generate} className="mt-5 h-[44px] rounded-[2px] bg-[#0073cf] px-[22px] text-[15px] font-bold text-white hover:bg-[#003865]">Create Verification</button>
  </>;
}

export function ProofCenter() {
  const { state, openProof, openCustomer } = useQuote();
  const policy = state.policies.find((entry) => entry.id === state.ui.policyId);
  const [collapsed, setCollapsed] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [preview, setPreview] = useState<PolicyDocument | null>(null);
  const [notice, setNotice] = useState('');
  if (!policy) return <div className="p-6 text-[14px]">Policy not found.</div>;
  const page = state.ui.proofPage;
  const back = page === 'hub' ? { label: 'Back to Customer Summary', onClick: () => openCustomer(customerKey(policy)) } : { label: 'Back to ID Cards and Documents', onClick: () => openProof(policy.id) };
  return <div className="flex min-h-screen bg-white text-[#1b2a36]">
    <Sidebar policy={policy} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} largeText={largeText} onLargeText={setLargeText} />
    <div className="flex min-w-0 flex-1 flex-col">
      <main className="mx-auto w-full max-w-[1100px] px-[40px] pt-[26px]" style={largeText ? { zoom: 1.15 } : undefined}>
        <button type="button" onClick={back.onClick} className="mb-[14px] text-[13px] font-bold text-[#0073cf] underline underline-offset-2 hover:text-[#003865]">← {back.label}</button>
        {notice && <p role="status" className="mb-4 rounded-[3px] border border-[#0f7a52] bg-[#eef8f3] px-3 py-2 text-[13px]">{notice} <button type="button" onClick={() => setNotice('')} className="ml-2 underline">Dismiss</button></p>}
        {page === 'hub' && <Hub policy={policy} onPreview={setPreview} />}
        {page === 'idcards' && <IdCardsPage policy={policy} onPreview={setPreview} onNotice={setNotice} />}
        {page === 'verification' && <VerificationPage policy={policy} onPreview={setPreview} />}
      </main>
      <Footer />
    </div>
    {preview && <DocumentPreview policy={policy} document={preview} onClose={() => setPreview(null)} />}
  </div>;
}
