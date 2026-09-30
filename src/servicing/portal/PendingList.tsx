// SmartView "Policies pending cancel or renewal": three tabs (non-payment, underwriting, renewals)
// with sorting, filtering, paging, export, print and Make Payment.
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { PolicyRecord } from '@/types/policy';
import type { PendingTab } from '@/context/quoteStore';
import { useQuote } from '@/context/useQuote';
import { customerKey } from '@/servicing/policyFilters';
import { hasPracticeBook } from '@/services/practiceBook';
import { formatCurrency } from '@/utils/masks';
import { PaymentModal } from '@/servicing/PolicyView';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';
import { BackLink, PortalLayout } from '@/servicing/portal/PortalLayout';

const TABS: [PendingTab, string][] = [['nonpayment', 'Pending Cancellation Due to Non-Payment'], ['underwriting', 'Pending Cancellation Due to Underwriting Reasons'], ['renewals', 'Pending Renewals']];

interface Row {
  policy: PolicyRecord;
  insured: string;
  policyNumber: string;
  product: string;
  state: string;
  agentCode: string;
  producer: string;
  date: string;
  amount: number;
  reason: string;
}

type Column = { key: keyof Omit<Row, 'policy'>; label: string };
const COLUMNS = (tab: PendingTab): Column[] => [
  { key: 'insured', label: 'Primary Named Insured' }, { key: 'policyNumber', label: 'Policy Number' }, { key: 'product', label: 'Product' }, { key: 'state', label: 'State' },
  { key: 'agentCode', label: 'Agent Code' }, { key: 'producer', label: 'Producer' },
  ...(tab === 'underwriting' ? [{ key: 'reason', label: 'Reason' } as Column] : []),
  { key: 'date', label: tab === 'renewals' ? 'Renewal Effective Date' : 'Cancel Effective Date' }, { key: 'amount', label: tab === 'renewals' ? 'Renewal Amount Due' : 'Amount Due' },
];

const sortValue = (row: Row, key: Column['key']) => {
  if (key === 'amount') return row.amount;
  if (key === 'date') { const [m, d, y] = row.date.split('/'); return `${y}${m}${d}`; }
  return String(row[key]).toLowerCase();
};

const lastFirst = (policy: PolicyRecord) => (policy.insured.firstName && policy.source.kind === 'personal' ? `${policy.insured.lastName}, ${policy.insured.firstName}` : policy.insured.name);
const shortProduct = (policy: PolicyRecord) => policy.productName.replace(' (HO4)', '').replace('Motorcycle/ATV', 'Motorcycle');
const phoneLink = (phone: string) => phone.replace(/^(\d{3})-(\d{3})-(\d{4})$/, '($1) $2-$3');

function rowsFor(tab: PendingTab, policies: PolicyRecord[], day: string, minimumDue: (policy: PolicyRecord, day: string) => number): Row[] {
  return policies.flatMap((policy) => {
    const base = { policy, insured: lastFirst(policy), policyNumber: policy.policyNumber, product: shortProduct(policy), state: 'NC', agentCode: policy.agentCode.split(' ')[0], producer: policy.agentName, reason: '' };
    if (tab === 'renewals') return policy.renewal?.status === 'Offered' && policy.status === 'Active' ? [{ ...base, date: policy.renewal.effectiveDate, amount: policy.renewal.dueToday }] : [];
    const pending = policy.pendingCancel;
    if (!pending || policy.status !== 'Pending Cancel') return [];
    if (tab === 'nonpayment' && pending.kind !== 'nonpayment') return [];
    if (tab === 'underwriting' && pending.kind !== 'company') return [];
    return [{ ...base, date: pending.effectiveDate, amount: minimumDue(policy, day), reason: pending.reason.replace(/^Underwriting:\s*(.)/, (_, first: string) => first.toUpperCase()) }];
  });
}

function toCsv(columns: Column[], rows: Row[]): string {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [columns.map((column) => cell(column.label)).join(','), ...rows.map((row) => columns.map((column) => cell(column.key === 'amount' ? row.amount.toFixed(2) : row[column.key])).join(','))].join('\r\n');
}

function EmailModal({ policy, onClose }: { policy: PolicyRecord; onClose: () => void }) {
  const { servicePolicy } = useQuote();
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(`Hello ${policy.insured.firstName || policy.insured.name},\n\nThis is a reminder about your ${policy.productName} policy #${policy.policyNumber}. Please contact our office or make a payment to keep your coverage active.\n\nThank you.`);
  const send = () => {
    servicePolicy(policy.id, (record, day) => ({ ...record, history: [...record.history, { id: `his-${Math.random().toString(36).slice(2, 9)}`, date: day, event: 'Customer emailed', detail: `Reminder emailed to ${policy.insured.email} (training simulation, not delivered).` }] }));
    setSent(true);
  };
  return <Modal title="Email Customer" width={620} onClose={onClose} footer={sent ? <button type="button" className={modalButton.primary} onClick={onClose}>Close</button> : <><button type="button" className={modalButton.secondary} onClick={onClose}>Cancel</button><button type="button" className={modalButton.primary} onClick={send}>Send Email</button></>}>
    {sent ? <p className="text-[14px]">Email logged to the policy history for <b>{policy.insured.email}</b>. Training simulation: no email was sent.</p> : <>
      <p className="mb-2 text-[13px]">To: <b>{policy.insured.email}</b></p>
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={8} className="w-full rounded-[3px] border border-[#7b8a95] p-2 text-[13px] outline-none focus:border-[#003865]" />
    </>}
  </Modal>;
}

export function PendingList() {
  const { state, openCustomer, showDashboard, loadPracticeBook, openPending, engine } = useQuote();
  const tab = state.ui.pendingTab;
  const [agentFilter, setAgentFilter] = useState('All');
  const [appliedAgent, setAppliedAgent] = useState('All');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [filterText, setFilterText] = useState('');
  const [filterColumn, setFilterColumn] = useState('');
  const [applied, setApplied] = useState({ text: '', column: '' });
  const [sort, setSort] = useState<{ key: Column['key']; asc: boolean }>({ key: 'date', asc: true });
  const [paying, setPaying] = useState<PolicyRecord | null>(null);
  const [emailing, setEmailing] = useState<PolicyRecord | null>(null);
  const [selected, setSelected] = useState('');
  const [notice, setNotice] = useState('');
  const columns = COLUMNS(tab);
  const agentCodes = useMemo(() => ['All', ...new Set(state.policies.map((policy) => policy.agentCode.split(' ')[0]))], [state.policies]);

  const rows = useMemo(() => {
    const all = rowsFor(tab, state.policies, state.simDate, engine.minimumDue)
      .filter((row) => appliedAgent === 'All' || row.agentCode === appliedAgent)
      .filter((row) => {
        const text = applied.text.trim().toLowerCase();
        if (!text) return true;
        const keys = applied.column ? [applied.column as Column['key']] : columns.map((column) => column.key);
        return keys.some((key) => String(key === 'amount' ? row.amount.toFixed(2) : row[key]).toLowerCase().includes(text));
      });
    return all.sort((a, b) => { const x = sortValue(a, sort.key); const y = sortValue(b, sort.key); return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1); });
  }, [tab, state.policies, state.simDate, engine.minimumDue, appliedAgent, applied, sort, columns]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const counts = Object.fromEntries(TABS.map(([key]) => [key, rowsFor(key, state.policies, state.simDate, engine.minimumDue).length]));

  const exportCsv = () => {
    const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pending-${tab}-${state.simDate.replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const header = (column: Column) => {
    const active = sort.key === column.key;
    return <th key={column.key} className="border-b-2 border-[#9aa5ad] bg-[#f3f2ed] px-[8px] py-[8px] text-left align-top"><button type="button" onClick={() => setSort({ key: column.key, asc: active ? !sort.asc : true })} className="flex w-full items-start justify-between gap-2 text-left text-[11.5px] font-bold text-[#003865] hover:text-[#0073cf]">{column.label}{active && !sort.asc ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className={`shrink-0 ${active ? '' : 'opacity-60'}`} />}</button></th>;
  };
  const button = 'h-[27px] rounded-[2px] bg-[#0073cf] px-[14px] text-[12px] font-bold text-white hover:bg-[#003865] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87722]';
  const empty = rowsFor('nonpayment', state.policies, state.simDate, engine.minimumDue).length + rowsFor('underwriting', state.policies, state.simDate, engine.minimumDue).length + rowsFor('renewals', state.policies, state.simDate, engine.minimumDue).length === 0;

  return <PortalLayout>
    <BackLink label="Back to Dashboard" onClick={showDashboard} />
    <h1 className="text-[24px] font-light text-[#1b2a36]">Policies Pending Cancellation or Renewal</h1>
    <p className="mt-2 flex items-center gap-2 text-[12px]"><Info size={16} className="text-[#0073cf]" />Policies listed are pending cancellation. Some of these require payment and some require follow up to avoid cancellation.</p>
    {notice && <p role="status" className="mt-3 max-w-[900px] rounded-[3px] border border-[#0f7a52] bg-[#eef8f3] px-3 py-2 text-[12.5px]">{notice} <button type="button" onClick={() => setNotice('')} className="ml-2 underline">Dismiss</button></p>}
    <div className="mt-5 print:hidden">
      <label className="block text-[11px] font-bold">Agent Codes<select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)} className="mt-1 block h-[26px] w-[160px] rounded-[2px] border border-[#8194a5] bg-white px-1 text-[12px] font-normal">{agentCodes.map((code) => <option key={code}>{code}</option>)}</select></label>
      <button type="button" onClick={() => { setAppliedAgent(agentFilter); setPage(1); }} className={`mt-3 ${button} h-[30px] px-[18px] text-[14px]`}>Submit</button>
    </div>
    {empty && <div className="mt-5 max-w-[900px] rounded-[3px] border border-[#cfdbe3] bg-[#f6f9fb] px-4 py-3 text-[12.5px] print:hidden">
      <b>No policies are pending cancellation or renewal.</b> Policies land here when a bill goes unpaid, underwriting schedules a cancellation, or a renewal offer is waiting for payment.
      {!hasPracticeBook(state.policies) && <div className="mt-2"><button type="button" onClick={() => { loadPracticeBook(); openPending('nonpayment'); setNotice('Five fictitious practice customers were added to your book of business.'); }} className={button}>Load 5 Practice Customers</button><span className="ml-2 text-[#5c6670]">Adds made-up accounts in each status for training.</span></div>}
    </div>}
    <div className="mt-4 flex items-end justify-between text-[12px] print:hidden">
      <span>Showing {rows.length ? (current - 1) * pageSize + 1 : 0} to {Math.min(current * pageSize, rows.length)} of {rows.length} entries</span>
      <div className="flex gap-2"><button type="button" onClick={exportCsv} disabled={!rows.length} className={`${button} disabled:opacity-50`}>Export</button><button type="button" onClick={() => window.print()} className={button}>Print</button></div>
    </div>
    <div className="mt-3 flex items-end justify-between gap-4 text-[12px] print:hidden">
      <label className="flex items-center gap-2 font-bold">Show<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-[24px] rounded-[2px] border border-[#8194a5] px-1 font-normal">{[10, 25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select>entries</label>
      <form onSubmit={(event) => { event.preventDefault(); setApplied({ text: filterText, column: filterColumn }); setPage(1); }} className="flex items-end gap-3">
        <label className="font-bold">Filter results<input value={filterText} onChange={(event) => setFilterText(event.target.value)} className="mt-1 block h-[24px] w-[150px] rounded-[2px] border border-[#8194a5] px-2 font-normal" /></label>
        <label className="font-bold">Table Column<select value={filterColumn} onChange={(event) => setFilterColumn(event.target.value)} className="mt-1 block h-[24px] w-[170px] rounded-[2px] border border-[#8194a5] px-1 font-normal"><option value="">Select One</option>{columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label>
        <button type="submit" className={button}>Filter</button>
      </form>
      <div className="flex items-center gap-2 font-bold text-[#003865]"><button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)} className="disabled:opacity-40">PREV</button><span className="border border-[#8194a5] px-2 py-[2px] font-normal">{current}</span>{pages > 1 && <span className="font-normal">of {pages}</span>}<button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)} className="disabled:opacity-40">NEXT</button></div>
    </div>
    <div role="tablist" className="mt-3 grid grid-cols-3 border border-[#9aa5ad] print:hidden">{TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { openPending(key); setPage(1); setSort({ key: 'date', asc: true }); }} className={`h-[34px] border-r border-[#9aa5ad] text-[12px] font-bold last:border-r-0 ${tab === key ? 'bg-[#0073cf] text-white' : 'bg-[#f3f2ed] text-[#1b2a36] hover:bg-white'}`}>{label} ({counts[key]})</button>)}</div>
    <h2 className="hidden text-[16px] font-bold print:block">{TABS.find(([key]) => key === tab)?.[1]}</h2>
    <table className="w-full border-collapse text-[12px]"><thead><tr>{columns.map(header)}</tr></thead><tbody>
      {visible.map((row) => {
        const policy = row.policy;
        const isSelected = selected === policy.id;
        return <tr key={policy.id} onClick={() => setSelected(policy.id)} className={`cursor-pointer border-b border-[#d5d9dd] align-top ${isSelected ? 'bg-[#c6ecfb] shadow-[inset_-4px_0_0_#0073cf]' : 'odd:bg-white even:bg-[#f3f2ed] hover:bg-[#e3f4fb]'}`}>
          <td className="px-[8px] py-[10px]"><button type="button" onClick={(event) => { event.stopPropagation(); openCustomer(customerKey(policy)); }} className="font-bold text-[#003865] underline underline-offset-2 hover:text-[#0073cf]">{row.insured}</button><div>{policy.insured.street}</div><div>{policy.insured.cityStateZip}</div>{policy.insured.phone && <a href={`tel:${policy.insured.phone}`} onClick={(event) => event.stopPropagation()} className="block font-bold text-[#003865] underline underline-offset-2">M: {phoneLink(policy.insured.phone)}</a>}{policy.insured.email && <button type="button" onClick={(event) => { event.stopPropagation(); setEmailing(policy); }} className="font-bold text-[#003865] underline underline-offset-2 hover:text-[#0073cf]">Email</button>}</td>
          <td className="px-[8px] py-[10px]">{row.policyNumber}</td>
          <td className="px-[8px] py-[10px]">{row.product}</td>
          <td className="px-[8px] py-[10px]">{row.state}</td>
          <td className="px-[8px] py-[10px]">{row.agentCode}</td>
          <td className="px-[8px] py-[10px]">{row.producer}</td>
          {tab === 'underwriting' && <td className="max-w-[260px] px-[8px] py-[10px]">{row.reason}</td>}
          <td className="px-[8px] py-[10px]">{row.date}</td>
          <td className="px-[8px] py-[10px]"><div className="font-bold">{formatCurrency(row.amount)}</div>{row.amount > 0 ? <button type="button" onClick={(event) => { event.stopPropagation(); setPaying(policy); }} className="mt-2 h-[26px] rounded-[2px] bg-[#003865] px-[14px] text-[11.5px] font-bold text-white hover:bg-[#0073cf] print:hidden">Make Payment</button> : <div className="mt-1 text-[11px] text-[#5c6670]">{tab === 'underwriting' ? 'Follow up required' : 'No payment due'}</div>}</td>
        </tr>;
      })}
      {!visible.length && <tr><td colSpan={columns.length} className="px-[8px] py-[18px] text-center text-[12.5px] text-[#5c6670]">No matching records found</td></tr>}
    </tbody></table>
    {paying && <PaymentModal policy={state.policies.find((entry) => entry.id === paying.id) ?? paying} preset={tab === 'renewals' ? paying.renewal?.dueToday : undefined} onClose={(text) => { setPaying(null); if (text) setNotice(`${paying.insured.name}, policy #${paying.policyNumber}: ${text}`); }} />}
    {emailing && <EmailModal policy={emailing} onClose={() => setEmailing(null)} />}
  </PortalLayout>;
}
