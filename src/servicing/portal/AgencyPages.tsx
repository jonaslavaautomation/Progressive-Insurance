// Products / Agency Admin / News / Support pages: product guides and underwriting, agency profile,
// production report, commission statement, agency news and help & contact.
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LedgerEntry, PolicyRecord } from '@/types/policy';
import type { FieldDef, ProductConfig } from '@/products/types';
import { useQuote } from '@/context/useQuote';
import { PRODUCT_CONFIGS } from '@/products/configs';
import { COMMERCIAL_CONFIGS } from '@/commercial/configs';
import { PortalLayout } from '@/servicing/portal/PortalLayout';
import { PageTitle, Tiles, Notice } from '@/servicing/portal/ServicePages';
import { blueButton, cell, headCell } from '@/servicing/portal/pageStyles';
import { guideRequest } from '@/servicing/portal/portalUtils';
import { inForce, monthKey } from '@/servicing/portal/bookStats';
import { formatCurrency } from '@/utils/masks';
import { SUPPORTED_STATES, rulesFor, type StateRules } from '@/data/states';
import { parseDate } from '@/utils/dates';

// ------------------------------------------------------------------ Product guides

const choiceLabels = (field: FieldDef) => (typeof field.options === 'function' ? ['Depends on the other selections'] : (field.options ?? []).map((option) => option.label));

function autoGuide(rules: StateRules): [string, string][] {
  return [
    ['Policy term', `6 months, ${rules.name}`],
    ['Minimum coverage', rules.minimumText],
    ['Uninsured / underinsured motorist', rules.um.text],
    ['Personal Injury Protection', rules.pip ? rules.pip.text : `Not part of the ${rules.name} auto policy.`],
    ['Medical Payments', rules.medPay.includes('None') ? (rules.medPay.length > 1 ? 'Optional.' : 'Not offered (PIP covers medical expenses).') : `Required: at least $${Number(rules.medPay[0]).toLocaleString('en-US')}.`],
    ['Insurance required?', rules.insuranceRequired ? 'Yes' : 'No. A policy that is purchased must meet the state minimums.'],
    ['No-fault state', rules.noFault ? 'Yes' : 'No'],
    ['Cancellation notice', rules.noticeText],
    ['State reporting', rules.reporting ? rules.reporting.text : 'No electronic insurance reporting requirement in this portal.'],
    ['Removing a vehicle', rules.plateSurrender ? `The plate must be surrendered at ${rules.plateSurrender.agency} or moved to another insured vehicle first; otherwise ${rules.plateSurrender.consequence}` : 'No plate surrender step.'],
    ['Physical damage', 'Collision requires Other Than Collision (comprehensive) on the same vehicle. Lienholders and lessors require both.'],
    ['Reports and binding', 'CLUE and MVR are ordered at Point of Sale. Effective date today through 60 days ahead; VINs required before binding.'],
  ];
}

function ConfigGuide({ config }: { config: ProductConfig }) {
  const rules = config.questions.filter((question) => question.ineligibleIf);
  return <div className="space-y-5">
    <table className="w-full max-w-[980px] border-collapse text-[12.5px]"><tbody>{([
      ['Policy term', `${config.termMonths} months`], ['Scheduled units', `Up to ${config.maxUnits} ${config.unitPlural.toLowerCase()}`], ['Minimum premium', formatCurrency(config.minimumPremium)],
      ['Motor vehicle reports', config.usesMvr ? 'MVR ordered for rated operators' : 'Not required'],
    ] as [string, string][]).map(([label, value]) => <tr key={label}><td className="w-[30%] border border-[#d7e0e6] bg-[#f6f9fb] px-3 py-[6px] font-medium">{label}</td><td className="border border-[#d7e0e6] px-3 py-[6px]">{value}</td></tr>)}</tbody></table>
    <section><h3 className="mb-2 text-[15px] font-bold text-[#003865]">Coverages</h3><table className="w-full max-w-[980px] border-collapse text-[12px]"><thead><tr><th className={headCell}>Coverage</th><th className={headCell}>Applies to</th><th className={headCell}>Options</th></tr></thead><tbody>{config.coverages.map((coverage) => <tr key={coverage.key}><td className={cell}>{coverage.label.replace(/[:*]/g, '')}{coverage.help && <div className="text-[11px] text-[#5c6670]">{coverage.help}</div>}</td><td className={cell}>{coverage.scope === 'policy' ? 'Whole policy' : `Each ${config.unitLabel.toLowerCase()}`}</td><td className={cell}>{choiceLabels(coverage).join(' · ')}</td></tr>)}</tbody></table></section>
    <section><h3 className="mb-2 text-[15px] font-bold text-[#003865]">Underwriting eligibility</h3>{rules.length ? <ul className="max-w-[980px] list-disc space-y-1 pl-5 text-[12.5px]">{rules.map((rule) => <li key={rule.key}><b>{rule.label.replace(/[*]/g, '')}</b> {rule.ineligibleIf}: {rule.ineligibleMessage}</li>)}</ul> : <p className="text-[12.5px] text-[#5c6670]">No automatic declinations; all risks are rated.</p>}</section>
    <section><h3 className="mb-2 text-[15px] font-bold text-[#003865]">Information needed to quote</h3><p className="max-w-[980px] text-[12.5px]">{config.unitFields.filter((field) => field.required || field.posRequired).map((field) => field.label.replace(/[:*]/g, '')).join(' · ')}</p></section>
  </div>;
}

export function ProductGuidesPage() {
  const guides = useMemo(() => [{ key: 'auto', name: 'Auto' }, ...Object.values(PRODUCT_CONFIGS).map((config) => ({ key: config.key, name: config.name })), ...Object.values(COMMERCIAL_CONFIGS).map((config) => ({ key: config.key, name: config.name }))], []);
  const [active, setActive] = useState(() => { const requested = guideRequest.product; guideRequest.product = ''; return requested || 'auto'; });
  const [guideState, setGuideState] = useState(() => { const requested = guideRequest.state; guideRequest.state = ''; return requested || 'North Carolina'; });
  const config = active === 'auto' ? null : PRODUCT_CONFIGS[active as keyof typeof PRODUCT_CONFIGS] ?? COMMERCIAL_CONFIGS[active as keyof typeof COMMERCIAL_CONFIGS];
  return <PortalLayout crumbs={[{ label: 'Products' }, { label: 'Product Guides & Underwriting' }]}>
    <PageTitle title="Product Guides & Underwriting" intro="Product rules, coverages and eligibility for North Carolina, Texas, Florida, Wisconsin, New Hampshire and Oregon. Guides are generated from the same rules the quoting system uses." />
    <div className="mt-5 flex gap-6">
      <nav aria-label="Products" className="w-[240px] shrink-0 border border-[#cfdbe3]">{guides.map((guide) => <button key={guide.key} type="button" onClick={() => setActive(guide.key)} className={`block w-full border-b border-[#e4ecf1] px-3 py-[9px] text-left text-[12.5px] font-bold last:border-b-0 ${active === guide.key ? 'bg-[#003865] text-white' : 'text-[#003865] hover:bg-[#e8f4fa]'}`}>{guide.name}</button>)}</nav>
      <div className="min-w-0 flex-1"><h2 className="mb-3 font-slab text-[20px] font-bold">{config?.name ?? 'Auto'}</h2>
        {config ? <ConfigGuide config={config} /> : <><label className="mb-3 block text-[12px] font-bold">State<select aria-label="Guide state" value={guideState} onChange={(event) => setGuideState(event.target.value)} className="ml-2 h-[28px] rounded-[2px] border border-[#8194a5] px-1 text-[12.5px] font-normal">{SUPPORTED_STATES.map((name) => <option key={name}>{name}</option>)}</select></label><table className="w-full max-w-[980px] border-collapse text-[12.5px]"><tbody>{autoGuide(rulesFor(guideState)).map(([label, value]) => <tr key={label}><td className="w-[30%] border border-[#d7e0e6] bg-[#f6f9fb] px-3 py-[6px] font-medium">{label}</td><td className="border border-[#d7e0e6] px-3 py-[6px]">{value}</td></tr>)}</tbody></table></>}
      </div>
    </div>
  </PortalLayout>;
}

// ------------------------------------------------------------------ Agency profile

export function AgencyPage() {
  const { state, updateAgent } = useQuote();
  const [draft, setDraft] = useState(state.agent);
  const [notice, setNotice] = useState('');
  const producers = useMemo(() => {
    const map = new Map<string, { policies: number; premium: number }>();
    for (const policy of state.policies.filter(inForce)) { const entry = map.get(policy.agentName) ?? { policies: 0, premium: 0 }; map.set(policy.agentName, { policies: entry.policies + 1, premium: entry.premium + policy.termPremium }); }
    return [...map.entries()].sort((a, b) => b[1].premium - a[1].premium);
  }, [state.policies]);
  const input = (key: keyof typeof draft, label: string) => <label className="block text-[13px]"><span className="mb-1 block font-medium">{label}</span><input value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: key === 'agencyCode' ? event.target.value.toUpperCase().slice(0, 8) : event.target.value })} className="h-[34px] w-full rounded-[3px] border border-[#7b8a95] px-2 text-[13px] outline-none focus:border-[#003865]" /></label>;
  return <PortalLayout crumbs={[{ label: 'Agency Admin' }, { label: 'Agency Profile' }]}>
    <PageTitle title="Agency Profile" intro="Your signed-in user, agency and producer code. The producer code prints on every quote, policy and ID card you issue." />
    <Notice text={notice} onDismiss={() => setNotice('')} />
    <div className="mt-5 grid max-w-[980px] grid-cols-2 gap-6">
      <section className="rounded-[3px] border border-[#cfdbe3] p-4"><h2 className="mb-3 text-[15px] font-bold text-[#003865]">Signed-in user</h2><div className="space-y-3">{input('name', 'Agent name')}{input('agencyName', 'Agency name')}{input('agencyCode', 'Producer code')}</div>
        <button type="button" onClick={() => { if (!draft.name.trim() || !draft.agencyName.trim() || !draft.agencyCode.trim()) { setNotice('Agent name, agency name and producer code are all required.'); return; } updateAgent({ name: draft.name.trim(), agencyName: draft.agencyName.trim(), agencyCode: draft.agencyCode.trim() }); setNotice('Agency profile saved.'); }} className={`mt-4 ${blueButton}`}>Save Profile</button>
      </section>
      <section className="rounded-[3px] border border-[#cfdbe3] p-4 text-[13px]"><h2 className="mb-3 text-[15px] font-bold text-[#003865]">Appointments</h2>
        <table className="w-full border-collapse"><tbody>{([['States', SUPPORTED_STATES.join(', ')], ['Lines', 'Personal Auto, Special Lines, Renters, Commercial Lines'], ['Appointment status', 'Active'], ['e-Signature', 'Enabled'], ['Payment methods', 'EFT, card by secure IVR, customer online payment']] as [string, string][]).map(([label, value]) => <tr key={label}><td className="w-[40%] border border-[#d7e0e6] bg-[#f6f9fb] px-3 py-[6px] font-medium">{label}</td><td className="border border-[#d7e0e6] px-3 py-[6px]">{value}</td></tr>)}</tbody></table>
      </section>
    </div>
    <h2 className="mt-8 text-[16px] font-bold text-[#003865]">Producers in this agency</h2>
    <table className="mt-2 w-full max-w-[980px] border-collapse text-[12px]"><thead><tr>{['Producer', 'Policies in force', 'Premium in force'].map((label) => <th key={label} className={headCell}>{label}</th>)}</tr></thead><tbody>{producers.map(([name, entry]) => <tr key={name}><td className={cell}>{name}</td><td className={cell}>{entry.policies}</td><td className={cell}>{formatCurrency(entry.premium)}</td></tr>)}</tbody></table>
  </PortalLayout>;
}

// ------------------------------------------------------------------ Production and commissions

type Written = { policy: PolicyRecord; entry: LedgerEntry; kind: 'New Business' | 'Renewal' | 'Endorsement' | 'Cancellation' };
const RATES: Record<Written['kind'], number> = { 'New Business': 0.12, Renewal: 0.1, Endorsement: 0.1, Cancellation: 0.1 };

function writtenIn(policies: PolicyRecord[], month: string): Written[] {
  const kind = (type: LedgerEntry['type']): Written['kind'] | null => (type === 'Premium' ? 'New Business' : type === 'Renewal Premium' ? 'Renewal' : type === 'Endorsement' ? 'Endorsement' : type === 'Cancellation Credit' ? 'Cancellation' : null);
  return policies.flatMap((policy) => policy.ledger.flatMap((entry) => { const k = kind(entry.type); return k && monthKey(entry.date) === month ? [{ policy, entry, kind: k }] : []; }));
}

function useMonths(day: string) {
  return useMemo(() => {
    const today = parseDate(day)!;
    return Array.from({ length: 12 }, (_, index) => { const date = new Date(today.getFullYear(), today.getMonth() - index, 1); return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }; });
  }, [day]);
}

function exportCsv(name: string, rows: (string | number)[][]) {
  const text = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function MonthPicker({ months, value, onChange, children }: { months: { key: string; label: string }[]; value: string; onChange: (value: string) => void; children?: ReactNode }) {
  return <div className="mt-5 flex items-end justify-between gap-3 print:hidden"><label className="text-[12px] font-bold">Month<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block h-[28px] w-[200px] rounded-[2px] border border-[#8194a5] px-1 text-[12.5px] font-normal">{months.map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}</select></label><div className="flex gap-2">{children}<button type="button" onClick={() => window.print()} className={blueButton}>Print</button></div></div>;
}

export function ProductionPage() {
  const { state } = useQuote();
  const months = useMonths(state.simDate);
  // Opens on the most recent month with written premium.
  const [month, setMonth] = useState(() => months.find((entry) => writtenIn(state.policies, entry.key).length)?.key ?? months[0].key);
  const rows = writtenIn(state.policies, month);
  const sum = (list: Written[]) => list.reduce((total, row) => total + row.entry.amount, 0);
  const group = (key: (row: Written) => string) => [...rows.reduce((map, row) => map.set(key(row), [...(map.get(key(row)) ?? []), row]), new Map<string, Written[]>()).entries()];
  const table = (title: string, groups: [string, Written[]][]) => <section className="mt-6"><h2 className="mb-2 text-[15px] font-bold text-[#003865]">{title}</h2><table className="w-full max-w-[980px] border-collapse text-[12px]"><thead><tr>{['', 'New Business', 'Renewals', 'Endorsements', 'Cancellations', 'Net Written'].map((label) => <th key={label} className={headCell}>{label}</th>)}</tr></thead><tbody>{groups.map(([name, list]) => <tr key={name}><td className={`${cell} font-medium`}>{name}</td>{(['New Business', 'Renewal', 'Endorsement', 'Cancellation'] as const).map((kind) => <td key={kind} className={cell}>{formatCurrency(sum(list.filter((row) => row.kind === kind)))}</td>)}<td className={`${cell} font-bold`}>{formatCurrency(sum(list))}</td></tr>)}{!groups.length && <tr><td colSpan={6} className={`${cell} text-center text-[#5c6670]`}>No premium written this month.</td></tr>}</tbody></table></section>;
  const label = months.find((entry) => entry.key === month)?.label ?? '';
  return <PortalLayout crumbs={[{ label: 'Agency Admin' }, { label: 'Production Report' }]}>
    <PageTitle title="Production Report" intro={`Written premium by transaction for ${state.agent.agencyName} (${state.agent.agencyCode}).`} />
    <MonthPicker months={months} value={month} onChange={setMonth}><button type="button" onClick={() => exportCsv(`production-${month}.csv`, [['Date', 'Policy', 'Named Insured', 'Product', 'Producer', 'Transaction', 'Premium'], ...rows.map((row) => [row.entry.date, row.policy.policyNumber, row.policy.insured.name, row.policy.productName, row.policy.agentName, row.kind, row.entry.amount.toFixed(2)])])} className={blueButton}>Export</button></MonthPicker>
    <h2 className="mt-4 hidden text-[16px] font-bold print:block">{label}</h2>
    <Tiles tiles={[['New business', `${rows.filter((row) => row.kind === 'New Business').length} · ${formatCurrency(sum(rows.filter((row) => row.kind === 'New Business')))}`], ['Renewals', `${rows.filter((row) => row.kind === 'Renewal').length} · ${formatCurrency(sum(rows.filter((row) => row.kind === 'Renewal')))}`], ['Endorsements', String(rows.filter((row) => row.kind === 'Endorsement').length)], ['Net written premium', formatCurrency(sum(rows))]]} />
    {table('By product', group((row) => row.policy.productName))}
    {table('By producer', group((row) => row.policy.agentName))}
  </PortalLayout>;
}

export function CommissionsPage() {
  const { state } = useQuote();
  const months = useMonths(state.simDate);
  const [month, setMonth] = useState(() => months.slice(1).find((entry) => writtenIn(state.policies, entry.key).length)?.key ?? months[1]?.key ?? months[0].key);
  const rows = writtenIn(state.policies, month).sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  const commission = (row: Written) => Math.round(row.entry.amount * RATES[row.kind] * 100) / 100;
  const total = rows.reduce((sum, row) => sum + commission(row), 0);
  const [year, mm] = month.split('-').map(Number);
  const statementDate = new Date(year, mm, 5).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  return <PortalLayout crumbs={[{ label: 'Agency Admin' }, { label: 'Commission Statement' }]}>
    <PageTitle title="Commission Statement" intro="Commission earned on written premium: new business 12%, renewals 10%, endorsements 10%. Cancellations are charged back at 10% of the returned premium." />
    <MonthPicker months={months} value={month} onChange={setMonth}><button type="button" onClick={() => exportCsv(`commission-${month}.csv`, [['Date', 'Policy', 'Named Insured', 'Transaction', 'Premium', 'Rate', 'Commission'], ...rows.map((row) => [row.entry.date, row.policy.policyNumber, row.policy.insured.name, row.kind, row.entry.amount.toFixed(2), `${RATES[row.kind] * 100}%`, commission(row).toFixed(2)])])} className={blueButton}>Export</button></MonthPicker>
    <div className="mt-4 max-w-[980px] rounded-[3px] border border-[#cfdbe3] p-4 text-[12.5px]">
      <div className="flex justify-between"><div><b>{state.agent.agencyName}</b><div>Producer code {state.agent.agencyCode}</div></div><div className="text-right"><div>Statement for {months.find((entry) => entry.key === month)?.label}</div><div>Statement date {statementDate}</div></div></div>
      <table className="mt-4 w-full border-collapse text-[12px]"><thead><tr>{['Date', 'Policy', 'Named Insured', 'Transaction', 'Premium', 'Rate', 'Commission'].map((label) => <th key={label} className={headCell}>{label}</th>)}</tr></thead><tbody>
        {rows.map((row) => <tr key={row.entry.id}><td className={cell}>{row.entry.date}</td><td className={cell}>{row.policy.policyNumber}</td><td className={cell}>{row.policy.insured.name}</td><td className={cell}>{row.kind}</td><td className={cell}>{formatCurrency(row.entry.amount)}</td><td className={cell}>{RATES[row.kind] * 100}%</td><td className={`${cell} font-medium`}>{formatCurrency(commission(row))}</td></tr>)}
        {!rows.length && <tr><td colSpan={7} className={`${cell} text-center text-[#5c6670]`}>No commissionable transactions this month.</td></tr>}
        <tr><td colSpan={6} className={`${cell} text-right font-bold`}>Total commission</td><td className={`${cell} font-bold`}>{formatCurrency(total)}</td></tr>
      </tbody></table>
      <p className="mt-3 text-[11px] text-[#5c6670]">Paid by direct deposit on the statement date. Training simulation: commission figures are illustrative.</p>
    </div>
  </PortalLayout>;
}

// ------------------------------------------------------------------ News and support

const NEWS: { date: string; title: string; body: string }[] = [
  { date: '01/22/2026', title: 'Exciting changes coming to FAO on January 22!', body: 'Updates to ForAgentsOnly give agents more control over licensing requests and streamline everyday servicing. Look for a new SmartView layout, faster policy search and one-click ID card printing from Customer Summary.' },
  { date: '12/15/2025', title: 'North Carolina auto rate filing', body: 'A base rate adjustment takes effect on new and renewal auto policies. Renewal offers show the change on the renewal declarations along with any loyalty credit the customer earns.' },
  { date: '11/03/2025', title: 'Binding restrictions during severe weather', body: 'When a hurricane or wildfire watch is issued for a county, new business and coverage increases for property and physical damage are suspended until the watch is lifted. Existing policies can still be serviced.' },
  { date: '09/08/2025', title: 'Commercial Lines appetite update', body: 'Artisan contractors, landscapers and office risks remain preferred classes. For-hire trucking and restaurants need underwriting review before binding.' },
  { date: '07/21/2025', title: 'Reminder: e-Sign within 10 days', body: 'Applications bound with e-Signature must be signed within 10 days. Use the e-Sign Follow-Up page to resend links and track unsigned applications.' },
];

export function NewsPage() {
  const [open, setOpen] = useState(0);
  return <PortalLayout crumbs={[{ label: 'News' }, { label: 'Agency News' }]}>
    <PageTitle title="Agency News" intro="Announcements, underwriting updates and reminders for your agency." />
    <div className="mt-5 max-w-[980px] space-y-2">{NEWS.map((item, index) => <article key={item.title} className="rounded-[3px] border border-[#cfdbe3]"><button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#f6f9fb]"><span><span className="block text-[11px] text-[#5c6670]">{item.date}</span><span className="text-[14px] font-bold text-[#003865]">{item.title}</span></span><ChevronDown size={18} className={`text-[#003865] ${open === index ? 'rotate-180' : ''}`} /></button>{open === index && <p className="border-t border-[#e4ecf1] px-4 py-3 text-[13px] leading-[19px]">{item.body}</p>}</article>)}</div>
  </PortalLayout>;
}

const FAQ: [string, string][] = [
  ['How do I retrieve a quote?', 'New Business › Retrieve Quote, or the Existing Quote tab on the dashboard.'],
  ['A customer received a cancellation notice. What do I do?', 'Open Manage Policies › Pending Cancel & Renewals. Take the minimum amount due before the cancel effective date to rescind the cancellation with no lapse.'],
  ['How do I print ID cards?', 'Open the customer (Customer Summary) › Get ID Cards and Documents › ID Cards › Print. Save, Mail and Fax are on the same page.'],
  ['How do I change a vehicle, driver, address or coverage?', 'Customer Summary › Quote or Make Changes, or Change Policy on the policy page. Review the prorated premium with the customer before submitting.'],
  ['How do I report a claim?', 'Manage Policies › Claims Center › Report a Claim. The claim is assigned to an adjuster immediately.'],
  ['What are SmartView Alerts?', 'SmartView Alerts on the dashboard list the policies that need action today: unsigned applications, past-due bills, pending cancellations and renewals, recent claims and changes.'],
];

export function SupportPage() {
  const { state, setTrainerMode, clearPolicies } = useQuote();
  const [notice, setNotice] = useState('');
  return <PortalLayout crumbs={[{ label: 'Support' }, { label: 'Help & Contact' }]}>
    <PageTitle title="Help & Contact" />
    <Notice text={notice} onDismiss={() => setNotice('')} />
    <div className="mt-5 grid max-w-[980px] grid-cols-2 gap-6">
      <section className="rounded-[3px] border border-[#cfdbe3] p-4 text-[13px] leading-[20px]"><h2 className="mb-2 text-[15px] font-bold text-[#003865]">Agency support</h2><p>Phone: <b>1-800-555-0123</b> (training line)</p><p>Hours: Monday - Friday 8 a.m. - 9 p.m., Saturday 9 a.m. - 5 p.m. ET</p><p>Claims 24/7: <b>1-800-555-0199</b> (training line)</p></section>
      <section className="rounded-[3px] border border-[#cfdbe3] p-4 text-[13px] leading-[20px]"><h2 className="mb-2 text-[15px] font-bold text-[#003865]">Trainer Mode</h2><p>Shows the training clock (move time forward to run bills, late fees, notices and renewals), training hints, sample customers and trainer tools.</p>
        <label className="mt-3 flex items-center gap-2 font-bold"><input type="checkbox" role="switch" checked={state.trainerMode} onChange={(event) => setTrainerMode(event.target.checked)} className="h-[16px] w-[16px] accent-[#0f7a52]" />Trainer Mode {state.trainerMode ? 'on' : 'off'}</label>
        {state.trainerMode && <button type="button" onClick={() => { if (window.confirm('Reset the book of business? Every policy you issued is deleted and the reference accounts are rebuilt.')) { clearPolicies(); setNotice('Book of business reset to the reference accounts.'); } }} className="mt-3 text-[12.5px] font-bold text-[#c8102e] underline">Reset book of business</button>}
      </section>
    </div>
    <h2 className="mt-8 text-[16px] font-bold text-[#003865]">Frequently asked questions</h2>
    <dl className="mt-2 max-w-[980px] divide-y divide-[#e4ecf1] rounded-[3px] border border-[#cfdbe3]">{FAQ.map(([question, answer]) => <div key={question} className="px-4 py-3"><dt className="text-[13.5px] font-bold">{question}</dt><dd className="mt-1 text-[13px] text-[#3d4b55]">{answer}</dd></div>)}</dl>
  </PortalLayout>;
}
