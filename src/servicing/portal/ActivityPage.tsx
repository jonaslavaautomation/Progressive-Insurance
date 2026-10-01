// Activity Log: the full history behind the notification bell, with filters, search and export.
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useQuote } from '@/context/useQuote';
import { activityStore, clearActivity, markRead, timeAgo, type ActivityKind } from '@/services/activity';
import { ACTIVITY_ICONS, useOpenActivity } from '@/components/activityUi';
import { PortalLayout } from '@/servicing/portal/PortalLayout';
import { PageTitle, Tiles } from '@/servicing/portal/ServicePages';
import { blueButton, cell, headCell } from '@/servicing/portal/pageStyles';

const KIND_LABELS: Record<ActivityKind, string> = { quote: 'Quotes', bind: 'Policies issued', document: 'Documents & ID cards', payment: 'Payments', change: 'Policy changes', claim: 'Claims', cancel: 'Cancellations & reinstatements', renewal: 'Renewals', billing: 'Billing', system: 'System', account: 'Sign-in & account' };

export function ActivityPage() {
  const { state } = useQuote();
  const entries = useSyncExternalStore(activityStore.subscribe, activityStore.get);
  const open = useOpenActivity();
  const [kind, setKind] = useState<'all' | ActivityKind>('all');
  const [search, setSearch] = useState('');
  const shown = useMemo(() => entries.filter((entry) => (kind === 'all' || entry.kind === kind) && (!search.trim() || `${entry.title} ${entry.detail} ${entry.by}`.toLowerCase().includes(search.trim().toLowerCase()))), [entries, kind, search]);
  const today = new Date().toDateString();
  const exportCsv = () => {
    const rows = [['Date/time', 'Training date', 'Type', 'Activity', 'Detail', 'By'], ...shown.map((entry) => [new Date(entry.at).toLocaleString('en-US'), entry.day, KIND_LABELS[entry.kind], entry.title, entry.detail, entry.by])];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n')], { type: 'text/csv' }));
    link.download = `account-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return <PortalLayout crumbs={[{ label: 'Agency Admin' }, { label: 'Activity Log' }]}>
    <PageTitle title="Activity Log" intro={`Everything done under this login: quotes, binds, ID cards and documents, payments, policy changes, claims and sign-ins. Signed in as ${state.agent.name} (${state.agent.agencyCode}). Activity is kept in this browser and updates live across its tabs.`} />
    <Tiles tiles={[['Today', String(entries.filter((entry) => new Date(entry.at).toDateString() === today).length)], ['Unread', String(entries.filter((entry) => !entry.read).length)], ['Documents generated', String(entries.filter((entry) => entry.kind === 'document').length)], ['Policies issued', String(entries.filter((entry) => entry.kind === 'bind').length)]]} />
    <div className="mt-5 flex flex-wrap items-end justify-between gap-3 text-[12px] print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        <label className="font-bold">Type<select value={kind} onChange={(event) => setKind(event.target.value as 'all' | ActivityKind)} className="mt-1 block h-[28px] w-[230px] rounded-[2px] border border-[#8194a5] px-1 font-normal"><option value="all">All activity</option>{(Object.keys(KIND_LABELS) as ActivityKind[]).map((key) => <option key={key} value={key}>{KIND_LABELS[key]}</option>)}</select></label>
        <label className="font-bold">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Customer, policy #, document..." className="mt-1 block h-[28px] w-[240px] rounded-[2px] border border-[#8194a5] px-2 font-normal" /></label>
      </div>
      <div className="flex gap-2"><button type="button" onClick={() => markRead()} className={blueButton}>Mark all as read</button><button type="button" onClick={exportCsv} disabled={!shown.length} className={`${blueButton} disabled:opacity-50`}>Export</button>{state.trainerMode && <button type="button" onClick={() => { if (window.confirm('Clear the activity log in this browser?')) clearActivity(); }} className={`${blueButton} bg-[#c8102e] hover:bg-[#9e0c24]`}>Clear Log</button>}</div>
    </div>
    <table className="mt-3 w-full border-collapse text-[12px]"><thead><tr>{['', 'When', 'Activity', 'Detail', 'By', ''].map((label, index) => <th key={index} className={headCell}>{label}</th>)}</tr></thead><tbody>
      {shown.map((entry) => { const Icon = ACTIVITY_ICONS[entry.kind]; return <tr key={entry.id} className={entry.read ? 'odd:bg-white even:bg-[#f7f7f4]' : 'bg-[#f2f8fd]'}>
        <td className={`${cell} w-[30px]`}><Icon size={16} className="text-[#0073cf]" /></td>
        <td className={`${cell} whitespace-nowrap`}><div>{new Date(entry.at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div><div className="text-[10.5px] text-[#7b858a]">{timeAgo(entry.at)}{entry.day ? ` · training date ${entry.day}` : ''}</div></td>
        <td className={`${cell} font-bold`}>{entry.title}<div className="text-[10.5px] font-normal text-[#5c6670]">{KIND_LABELS[entry.kind]}</div></td>
        <td className={cell}>{entry.detail}</td>
        <td className={`${cell} whitespace-nowrap`}>{entry.by}</td>
        <td className={`${cell} whitespace-nowrap`}>{entry.target ? <button type="button" onClick={() => open(entry)} className="font-bold text-[#0073cf] underline">Open</button> : !entry.read && <button type="button" onClick={() => markRead(entry.id)} className="text-[#0073cf] underline">Mark read</button>}</td>
      </tr>; })}
      {!shown.length && <tr><td colSpan={6} className={`${cell} text-center text-[#5c6670]`}>No activity to show.</td></tr>}
    </tbody></table>
  </PortalLayout>;
}
