// OPTIONS > Print/Email/Fax: the quote document center.
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CheckCircle2, Printer, X } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { applyMask } from '@/utils/masks';
import { FormHeader, PageLinks } from '@/components/wizard/WizardLayout';
import { InlineError, SelectControl, TextControl, focusRing } from '@/components/wizard/primitives';
import { QuoteSheet, type DocumentKind } from '@/components/quote/QuoteSheet';

type Tab = 'Print' | 'Email' | 'Fax';
const DOCUMENT_OPTIONS: [Exclude<DocumentKind, 'binder'>, string][] = [['selected', 'Insurance quote (with selected bill plan)'], ['all', 'Insurance quote (with all bill plans)'], ['set', 'Document set']];
const ADDRESS_OPTIONS = ['Agency default', 'Agency mailing address', 'Agent office address'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const focusable = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';

/** Full-screen PDF preview; it is the only thing printed while open (see index.css). */
function DocumentPreview({ kind, address, autoPrint, onClose }: { kind: DocumentKind; address: string; autoPrint: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);
  return createPortal(<div className="print-portal fixed inset-0 z-[90] overflow-y-auto bg-[#1b2a36]/70 px-4 pb-10 pt-[20px]">
    <div className="no-print sticky top-0 z-10 mx-auto mb-[14px] flex max-w-[800px] items-center justify-between rounded-[3px] bg-[#003865] px-[16px] py-[10px] text-white shadow-lg"><span className="text-[14px] font-bold">PDF Preview: {DOCUMENT_OPTIONS.find(([value]) => value === kind)?.[1] ?? 'Binder'}</span><span className="flex items-center gap-[10px]"><button type="button" onClick={() => window.print()} className={`flex h-[34px] items-center gap-2 rounded-[3px] bg-white px-[14px] text-[12px] font-bold uppercase text-[#003865] ${focusable}`}><Printer size={15} />Print / Save as PDF</button><button type="button" aria-label="Close preview" onClick={onClose} className={`rounded p-1 ${focusable}`}><X size={20} /></button></span></div>
    <QuoteSheet kind={kind} agencyAddress={address} />
  </div>, document.body);
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="font-slab text-[17px] font-bold text-[#2e3a43]">{children}</h3>;
}

function DocumentChoice({ value, onChange }: { value: DocumentKind; onChange: (value: Exclude<DocumentKind, 'binder'>) => void }) {
  return <div role="radiogroup" className="mt-[16px] space-y-[16px]">{DOCUMENT_OPTIONS.map(([option, label]) => <label key={option} className="flex cursor-pointer items-center gap-[12px] text-[14px]"><input type="radio" name="documents" checked={value === option} onChange={() => onChange(option)} className="h-[20px] w-[20px] accent-[#003865]" />{label}</label>)}</div>;
}

function LabeledInput({ id, label, children, error }: { id: string; label: string; children: ReactNode; error?: string }) {
  return <div className="flex items-start text-[14px]"><label htmlFor={id} className="flex min-h-[38px] w-[170px] shrink-0 items-center">{label}</label><span className="w-[360px]">{children}<InlineError message={error} /></span></div>;
}

export function DocumentCenter() {
  const { state, goToStep } = useQuote();
  const { policy, insured } = state;
  const [tab, setTab] = useState<Tab>('Print');
  const [kind, setKind] = useState<Exclude<DocumentKind, 'binder'>>('selected');
  const [address, setAddress] = useState(ADDRESS_OPTIONS[0]);
  const [preview, setPreview] = useState<null | { print: boolean }>(null);
  const [email, setEmail] = useState({ to: insured.email, subject: `Your Auto Insurance Quote #${policy.quoteNumber}`, message: `Hello ${insured.firstName || 'there'},\n\nAttached is your auto insurance quote. Please review it and contact me with any questions.\n\n${state.agent.name}\n${state.agent.agencyName}` });
  const [fax, setFax] = useState({ number: '', recipient: [insured.firstName, insured.lastName].filter(Boolean).join(' '), note: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<string[]>([]);

  const sendEmail = () => {
    const next: Record<string, string> = {};
    if (!EMAIL.test(email.to)) next.to = 'Enter a valid email address.';
    if (!email.subject.trim()) next.subject = 'Subject is required.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSent([`Emailed ${DOCUMENT_OPTIONS.find(([value]) => value === kind)?.[1]} to ${email.to} at ${new Date().toLocaleTimeString('en-US')} (simulated).`, ...sent]);
  };
  const sendFax = () => {
    const next: Record<string, string> = {};
    if (!/^\d{3}-\d{3}-\d{4}$/.test(fax.number)) next.fax = 'Enter a 10-digit fax number.';
    if (!fax.recipient.trim()) next.recipient = 'Recipient is required.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSent([`Faxed ${DOCUMENT_OPTIONS.find(([value]) => value === kind)?.[1]} to ${fax.recipient} at ${fax.number} (simulated).`, ...sent]);
  };
  const input = `h-[38px] w-full rounded-[4px] border border-[#7b8a95] bg-white px-[12px] text-[14px] outline-none ${focusRing}`;

  return <div className="flex h-screen flex-col bg-[#f1f6f9] text-[#2e3a43]">
    <FormHeader />
    <div className="flex min-h-0 flex-1">
      <nav aria-label="Document delivery" className="w-[160px] shrink-0 pt-[70px]"><ul className="space-y-[12px]">{(['Print', 'Email', 'Fax'] as Tab[]).map((entry) => <li key={entry}><button type="button" onClick={() => { setTab(entry); setErrors({}); }} className={`relative block py-[2px] pl-[60px] text-[14px] underline-offset-2 ${focusable} ${tab === entry ? 'font-medium before:absolute before:bottom-0 before:left-[48px] before:top-0 before:w-[3px] before:bg-[#003865]' : 'text-[#003865] underline hover:text-[#0073cf]'}`}>{entry}</button></li>)}</ul></nav>
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="px-[5px] pt-[20px]">
          <div className="relative flex h-[60px] w-[176px] flex-col items-center justify-center bg-[#003865] text-white"><div className="text-[15px] font-bold leading-[19px]">AUTO</div><div className="text-[13px] leading-[17px]">Quote #: {policy.quoteNumber || '—'}</div><span className="absolute -bottom-[9px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[9px] border-x-transparent border-t-[#003865]" /></div>
          <section className="mt-[10px] w-[1155px] rounded-[3px] border border-[#cfdbe3] bg-white px-[24px] pb-[34px] pt-[18px]">
            <div className="flex items-start border-b border-[#d7e0e6] pb-[16px]">
              <div className="w-[108px]"><div className="text-[11px] font-bold uppercase tracking-[.3px]">Status</div><div className="text-[14px]">{policy.policyNumber ? 'Sold' : 'Not Sold'}</div></div>
              <div className="w-[160px]"><div className="text-[11px] font-bold uppercase tracking-[.3px]">Policy Number</div><div className="text-[14px]">{policy.policyNumber || '—'}</div></div>
              <div className="ml-[280px] flex-1"><div className="font-slab text-[17px] font-bold">Preview document</div><div className="text-[12px]">Use <a href="https://get.adobe.com/reader/" target="_blank" rel="noreferrer" className="text-[#0073cf] underline">Adobe Acrobat Reader</a> to view the PDF</div></div>
              <button type="button" onClick={() => setPreview({ print: false })} className="h-[40px] rounded-[3px] border-2 border-[#003865] bg-white px-[18px] text-[12.5px] font-bold uppercase text-[#003865] shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722] outline-none hover:bg-[#e8f4fa]">Open / Save PDF</button>
            </div>
            <div className="mt-[22px]"><Heading>1. Select documents to include*</Heading><DocumentChoice value={kind} onChange={setKind} /></div>
            {tab === 'Print' && <div className="mt-[30px]"><Heading>2. Alternate agency address selection</Heading><div className="mt-[16px] flex items-center gap-[16px] text-[14px]"><label htmlFor="doc-address">Mailing address:*</label><SelectControl id="doc-address" value={address} options={ADDRESS_OPTIONS} onChange={setAddress} className="w-[230px]" /></div></div>}
            {tab === 'Email' && <div className="mt-[30px] space-y-[14px]"><Heading>2. Email details</Heading>
              <LabeledInput id="doc-to" label="To:*" error={errors.to}><TextControl id="doc-to" type="email" value={email.to} onChange={(to) => setEmail({ ...email, to })} error={errors.to} /></LabeledInput>
              <LabeledInput id="doc-subject" label="Subject:*" error={errors.subject}><TextControl id="doc-subject" value={email.subject} onChange={(subject) => setEmail({ ...email, subject })} error={errors.subject} /></LabeledInput>
              <LabeledInput id="doc-message" label="Message:"><textarea id="doc-message" rows={6} value={email.message} onChange={(event) => setEmail({ ...email, message: event.target.value })} className={`${input} h-auto py-[8px]`} /></LabeledInput>
              <button type="button" onClick={sendEmail} className={`ml-[170px] h-[40px] rounded-[3px] bg-[#0073cf] px-[18px] text-[12.5px] font-bold uppercase text-white hover:bg-[#003865] ${focusable}`}>Send Email</button>
            </div>}
            {tab === 'Fax' && <div className="mt-[30px] space-y-[14px]"><Heading>2. Fax details</Heading>
              <LabeledInput id="doc-fax" label="Fax Number:*" error={errors.fax}><input id="doc-fax" value={fax.number} placeholder="XXX-XXX-XXXX" onChange={(event) => setFax({ ...fax, number: applyMask('phone', event.target.value) })} className={input} /></LabeledInput>
              <LabeledInput id="doc-recipient" label="Recipient:*" error={errors.recipient}><input id="doc-recipient" value={fax.recipient} onChange={(event) => setFax({ ...fax, recipient: event.target.value })} className={input} /></LabeledInput>
              <LabeledInput id="doc-note" label="Cover Note:"><input id="doc-note" value={fax.note} onChange={(event) => setFax({ ...fax, note: event.target.value })} className={input} /></LabeledInput>
              <button type="button" onClick={sendFax} className={`ml-[170px] h-[40px] rounded-[3px] bg-[#0073cf] px-[18px] text-[12.5px] font-bold uppercase text-white hover:bg-[#003865] ${focusable}`}>Send Fax</button>
            </div>}
            {sent.length > 0 && <ul role="status" className="mt-[20px] space-y-1">{sent.map((entry) => <li key={entry} className="flex items-center gap-2 text-[13px] font-medium text-[#0b5d3f]"><CheckCircle2 size={16} />{entry}</li>)}</ul>}
          </section>
        </div>
        <PageLinks />
      </main>
    </div>
    <div className="flex h-[57px] shrink-0 items-center justify-center gap-[11px] border-t border-[#d7dfe4] bg-white shadow-[0_-2px_5px_rgba(0,0,0,.05)]">
      <button type="button" onClick={() => goToStep(state.ui.step)} className={`flex h-[40px] items-center gap-[8px] rounded-[3px] border-2 border-[#0073cf] bg-white px-[16px] text-[12.5px] font-bold uppercase text-[#003865] hover:bg-[#e8f4fa] ${focusable}`}><ArrowLeft size={16} strokeWidth={2.4} />Return to Quote</button>
      <button type="button" onClick={() => setPreview({ print: true })} className={`h-[40px] rounded-[3px] border-2 border-[#0073cf] bg-[#0073cf] px-[22px] text-[12.5px] font-bold uppercase text-white hover:border-[#003865] hover:bg-[#003865] ${focusable}`}>Print</button>
    </div>
    {preview && <DocumentPreview kind={kind} address={address} autoPrint={preview.print} onClose={() => setPreview(null)} />}
  </div>;
}
