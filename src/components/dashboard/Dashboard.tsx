import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { useQuote } from '@/context/useQuote';
import type { PortalPage } from '@/context/quoteStore';
import { matchesStatus } from '@/servicing/policyFilters';
import { claimsOf, crossSellOpportunities, inForce, paperlessPending, prospects, recentChanges } from '@/servicing/portal/bookStats';
import { guideRequest } from '@/servicing/portal/portalUtils';
import { SUPPORTED_STATES, type StateName } from '@/data/states';
import { dayDiff } from '@/services/policyEngine';
import { formatLogin, sessionStore, signOut, signOutAndClear } from '@/services/session';
import { SEARCH_ACTIONS, resolveSearch, type SearchAction } from '@/servicing/account/accountModel';
import { LegalLink } from '@/components/LegalLink';
import { NotificationBell } from '@/components/NotificationBell';
import { parseDate } from '@/utils/dates';
import { Bookmark, ChevronDown, CircleHelp, FileText, LogOut, Menu, Plus, RotateCcw, Search, UserRound, X } from 'lucide-react';

type AlertItem = { text: string; onClick?: () => void };
type AlertSection = { title: string; items: AlertItem[] };
type MenuItem = { label: string; onClick: () => void };

/** Global navigation with dropdown menus (click or keyboard; closes on outside click or Escape). */
function NavMenus({ mobileOpen }: { mobileOpen: boolean }) {
  const { openPolicies, openPending, openPage, showDashboard } = useQuote();
  const [open, setOpen] = useState('');
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !nav.current?.contains(event.target as Node)) setOpen(''); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const page = (target: PortalPage) => () => openPage(target);
  const menus: [string, MenuItem[]][] = [
    ['New Business', [
      { label: 'New Quote/Quote Preferences', onClick: page('newQuote') },
      { label: 'Existing Quote', onClick: page('existingQuotes') },
      { label: 'Delete Quote', onClick: page('existingQuotes') },
      { label: 'Book Growth Program', onClick: page('bookBuilder') },
    ]],
    ['Prospecting', [{ label: 'Requote Prospects', onClick: page('prospects') }, { label: 'Cross-Sell Opportunities', onClick: page('crossSell') }]],
    ['Manage Policies', [
      { label: 'Policy Search', onClick: () => openPolicies() },
      { label: 'Pending Cancel & Renewals', onClick: () => openPending() },
      { label: 'Billing Center', onClick: page('billing') },
      { label: 'e-Sign Follow-Up', onClick: page('esign') },
      { label: 'Claims Center', onClick: page('claims') },
    ]],
    ['Products', [{ label: 'Product Guides & Underwriting', onClick: page('productGuides') }]],
    ['Agency Admin', [{ label: 'Activity Log', onClick: page('activity') }, { label: 'Agency Profile', onClick: page('agency') }, { label: 'Production Report', onClick: page('production') }, { label: 'Commission Statement', onClick: page('commissions') }]],
    ['News', [{ label: 'Agency News', onClick: page('news') }, { label: 'Dashboard', onClick: showDashboard }]],
    ['Support', [{ label: 'Help & Contact', onClick: page('support') }]],
  ];
  return <nav ref={nav} aria-label="Main" className={`${mobileOpen ? 'flex' : 'hidden'} absolute left-0 right-0 top-[50px] z-40 flex-col bg-[#003865] px-5 pb-4 md:static md:flex md:flex-row md:items-center md:gap-5 md:p-0`}>
    {menus.map(([title, items]) => <div key={title} className="relative">
      <button type="button" aria-expanded={open === title} aria-haspopup="menu" onClick={() => setOpen(open === title ? '' : title)} className={`flex w-full items-center justify-between gap-1 border-b border-white/10 py-2 text-left text-[11px] font-semibold whitespace-nowrap hover:text-[#f5a45d] md:border-0 md:py-0 ${open === title ? 'text-[#f5a45d]' : ''}`}>{title}<ChevronDown size={12} className={open === title ? 'rotate-180' : ''} /></button>
      {open === title && <ul role="menu" className="z-50 mt-1 min-w-[210px] rounded-[2px] border border-[#a6adb3] bg-white py-1 text-[#003865] shadow-lg md:absolute md:left-0 md:top-[26px]">{items.map((item) => <li key={item.label} role="none"><button type="button" role="menuitem" onClick={() => { setOpen(''); item.onClick(); }} className="block w-full px-3 py-[7px] text-left text-[11.5px] font-semibold hover:bg-[#e8f4fa] hover:text-[#0073cf] focus-visible:bg-[#e8f4fa] focus-visible:outline-none">{item.label}</button></li>)}</ul>}
    </div>)}
  </nav>;
}

/** Bookmark (quick links) and the notification bell in the global header. */
function HeaderShortcuts() {
  const { openPolicies, openPending, openPage, openProductPicker } = useQuote();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const links: [string, () => void][] = [['Start a New Quote', openProductPicker], ['Policy Search', () => openPolicies()], ['Pending Cancel & Renewals', () => openPending()], ['Billing Center', () => openPage('billing')], ['Claims Center', () => openPage('claims')], ['Activity Log', () => openPage('activity')], ['Product Guides', () => openPage('productGuides')]];
  return <div className="relative hidden items-center gap-4 sm:flex">
    <div ref={box} className="relative">
      <button type="button" aria-label="Quick links" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center hover:text-[#f5a45d]"><Bookmark size={18} fill="currentColor" /></button>
      {open && <div className="absolute right-0 top-[30px] z-50 w-[240px] rounded-[3px] border border-[#a6adb3] bg-white py-1 text-left text-[#003865] shadow-lg"><div className="border-b border-[#e4ecf1] px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[.4px] text-[#5c6670]">Quick links</div>{links.map(([label, action]) => <button key={label} type="button" onClick={() => { setOpen(false); action(); }} className="block w-full px-3 py-[7px] text-left text-[11.5px] font-semibold hover:bg-[#e8f4fa] hover:text-[#0073cf]">{label}</button>)}</div>}
    </div>
    <NotificationBell />
  </div>;
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { showDashboard } = useQuote();
  return <header className="relative bg-[#003865] text-white shadow-sm">
    <div className="mx-auto flex min-h-[50px] max-w-[1440px] items-center gap-5 px-4">
      <div className="flex shrink-0 items-center gap-2"><button className="rounded p-1 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open navigation"><Menu size={20} /></button><button type="button" onClick={showDashboard} title="Home" className="flex items-center gap-2"><span className="flex h-[32px] items-center rounded-[4px] bg-white px-[8px]"><img src="/lava-logo.png" alt="LAVA" className="h-[20px] w-auto" /></span><span className="h-[24px] w-px bg-white/30" aria-hidden /><span className="whitespace-nowrap text-[17px] font-light tracking-[-.6px]">LAVA<span className="font-bold">TRAINING</span></span></button></div>
      <NavMenus mobileOpen={menuOpen} />
      <div className="ml-auto flex shrink-0 items-center gap-3"><HeaderShortcuts /><UserRound size={19} fill="white" className="hidden sm:block" /><AgentGreeting /></div>
    </div>
  </header>;
}

/** "Hello, [agent]" with the profile menu: signed-in agent, Trainer Mode, last login and Sign Out. */
function AgentGreeting() {
  const { state, updateAgent, setTrainerMode } = useQuote();
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
  const { agent } = state;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(agent);
  const field = (key: keyof typeof agent, label: string) => <label className="block text-[10px] font-bold text-[#003865]">{label}<input value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: key === 'agencyCode' ? event.target.value.toUpperCase().slice(0, 8) : event.target.value })} className="mt-0.5 h-[24px] w-full rounded-[2px] border border-[#8194a5] px-2 text-[11px] font-normal text-[#28343c] outline-none focus:border-[#0073cf]" /></label>;
  return <div className="relative text-right text-[10px] font-semibold leading-[1.15]"><div>Hello, {agent.name}</div><button type="button" aria-expanded={open} onClick={() => { setDraft(agent); setOpen(!open); }} className="flex items-center gap-1 whitespace-nowrap text-[9px] font-normal hover:text-[#f5a45d]">{agent.agencyName} ({agent.agencyCode}) <ChevronDown size={11} /></button>
    {open && <form onSubmit={(event) => { event.preventDefault(); if (draft.name.trim() && draft.agencyName.trim() && draft.agencyCode.trim()) { updateAgent({ name: draft.name.trim(), agencyName: draft.agencyName.trim(), agencyCode: draft.agencyCode.trim() }); setOpen(false); } }} className="absolute right-0 top-[30px] z-50 w-[240px] space-y-2 rounded-[3px] border border-[#a6adb3] bg-white p-3 text-left text-[#28343c] shadow-lg">
      <div className="text-[11px] font-bold text-[#003865]">Signed-in agent</div>
      {field('name', 'Agent name')}{field('agencyName', 'Agency name')}{field('agencyCode', 'Producer code')}
      <div className="flex justify-end gap-1 pt-1"><button type="button" onClick={() => setOpen(false)} className="bg-[#003865] px-2 py-1 text-[9px] font-bold text-white">CANCEL</button><button type="submit" className="bg-[#0073cf] px-2 py-1 text-[9px] font-bold text-white">SAVE</button></div>
      <label className="flex items-center justify-between border-t border-[#e4ecf1] pt-2 text-[10.5px] font-bold text-[#003865]">Trainer Mode<input type="checkbox" role="switch" checked={state.trainerMode} onChange={(event) => setTrainerMode(event.target.checked)} className="h-[15px] w-[15px] accent-[#0f7a52]" /></label>
      <p className="text-[9.5px] font-normal leading-[13px] text-[#5c6670]">Shows the training clock, hints, sample data and trainer tools.</p>
      <div className="border-t border-[#e4ecf1] pt-2 text-[9.5px] font-normal text-[#5c6670]">Last login: {formatLogin(session.lastLogin)}</div>
      <button type="button" onClick={() => signOut('manual')} className="flex w-full items-center justify-center gap-1 border border-[#003865] py-1 text-[10px] font-bold text-[#003865] hover:bg-[#e8f4fa]"><LogOut size={12} />SIGN OUT</button>
      <button type="button" onClick={() => { if (window.confirm('Sign out and erase all LAVA Training data stored on this computer (policies, quotes, activity and preferences)? Use this on shared computers.')) signOutAndClear(); }} className="w-full text-center text-[9.5px] font-bold text-[#c8102e] underline">Sign out and clear this computer</button>
    </form>}
  </div>;
}

const PRODUCT_SEARCH: Record<string, string> = { All: 'All', Auto: 'auto', 'Motorcycle/ATV': 'motorcycle', 'Boat/PWC': 'boat', 'Motor Home': 'motorhome', 'Travel Trailer': 'trailer', Snowmobile: 'snowmobile', 'Renters (HO4)': 'renters' };
const STATUS_SEARCH: Record<string, string> = { 'Active Policies': 'In Force', 'All Policies': 'All', Pending: 'Pending Cancel', Cancelled: 'Cancelled' };

export function SearchBar() {
  const { state, openPolicies, openAccount, openPolicy, openProof } = useQuote();
  const agentCode = state.agent.agencyCode;
  const [mode, setMode] = useState<'Customer' | 'Policy'>('Policy');
  const empty = { last: '', first: '', product: 'All', status: 'Active Policies', agent: 'All', action: 'Policy Summary' as SearchAction };
  const [values, setValues] = useState(empty);
  const setValue = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const reset = () => setValues(empty);
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // A policy number has its own status; the status filter only narrows customer searches.
    const query = { mode, lastName: mode === 'Customer' ? values.last : '', firstName: mode === 'Customer' ? values.first : '', policyNumber: mode === 'Policy' ? values.last.replace(/\D/g, '') : '', product: mode === 'Customer' ? PRODUCT_SEARCH[values.product] ?? 'All' : 'All', status: mode === 'Customer' ? STATUS_SEARCH[values.status] ?? 'All' : 'All' };
    const outcome = resolveSearch(state.policies, query, state.simDate);
    if (outcome.kind !== 'account') { openPolicies(query); return; }
    const id = outcome.policyId;
    const open: Record<SearchAction, () => void> = { 'Policy Summary': () => openAccount(id), 'Billing and Payments': () => openPolicy(id, 'billing'), Documents: () => openPolicy(id, 'documents'), 'Policy Activity': () => openPolicy(id, 'history'), 'ID Cards and Proof': () => openProof(id) };
    open[values.action]();
  };
  return <div className="border-b border-[#a8b0b8] bg-[#f3f4f6] px-4 py-2"><form onSubmit={search} className="mx-auto flex max-w-[1440px] flex-wrap items-end gap-x-2 gap-y-1 text-[10px] text-[#003865]"><div className="flex flex-col gap-1 pr-1 font-semibold"><label className="flex items-center gap-1"><input type="radio" name="search" checked={mode === 'Customer'} onChange={() => setMode('Customer')} className="accent-[#0073cf]" /> Customer</label><label className="flex items-center gap-1"><input type="radio" name="search" checked={mode === 'Policy'} onChange={() => setMode('Policy')} className="accent-[#0073cf]" /> Policy</label></div><SearchField label={mode === 'Customer' ? 'Last Name' : 'Policy Number'} value={values.last} onChange={(value) => setValue('last', value)} />{mode === 'Customer' && <><SearchField label="First Name" value={values.first} onChange={(value) => setValue('first', value)} /><SelectField label="Products" value={values.product} options={Object.keys(PRODUCT_SEARCH)} onChange={(value) => setValue('product', value)} /><SelectField label="Policy Status" value={values.status} options={Object.keys(STATUS_SEARCH)} onChange={(value) => setValue('status', value)} /><SelectField label="Agent Codes" value={values.agent} options={['All', agentCode]} onChange={(value) => setValue('agent', value)} /></>}<SelectField label="Action" value={values.action} options={[...SEARCH_ACTIONS]} onChange={(value) => setValue('action', value)} wide /><div className="flex items-end gap-1 pb-0.5"><button type="submit" className="flex h-[18px] min-w-[105px] items-center justify-center gap-1 bg-[#0073cf] px-3 text-[10px] font-bold text-white hover:bg-[#005da8]"><Search size={11} /> Search</button><button type="button" onClick={reset} className="flex h-[18px] min-w-[68px] items-center justify-center gap-1 bg-[#003865] px-3 text-[10px] font-bold text-white hover:bg-[#002746]"><RotateCcw size={10} /> Reset</button></div></form></div>;
}
function SearchField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="flex flex-col gap-1 font-bold"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="h-[18px] w-[160px] rounded-[2px] border border-[#8194a5] bg-white px-2 text-[10px] font-normal outline-none focus:border-[#0073cf]" /></label>; }
function SelectField({ label, value, options, onChange, wide = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; wide?: boolean }) { return <label className="flex flex-col gap-1 font-bold"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={`h-[18px] ${wide ? 'w-[130px]' : 'w-[115px]'} rounded-[2px] border border-[#8194a5] bg-white px-1 text-[10px] font-normal outline-none focus:border-[#0073cf]`}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }

type QuoteActions = { onSelect: () => void; onOpenExisting: () => void; existingQuote: string };
function QuoteCard({ onSelect, onOpenExisting, existingQuote }: QuoteActions) {
  const { state, openCommercial, setQuoteState } = useQuote();
  const commercial = state.commercial && !state.commercial.boundPolicyIds.length ? `${state.commercial.productQuotes[state.commercial.products[0]]?.quoteNumber ?? ''} - ${state.commercial.business.name || 'New Business'} (Commercial)` : '';
  const [pick, setPick] = useState<'personal' | 'commercial'>('personal');
  const choice = existingQuote && commercial ? pick : commercial ? 'commercial' : 'personal';
  const hasExisting = !!(existingQuote || commercial);
  const [activeTab, setActiveTab] = useState<'new' | 'existing'>('new');
  return <section className="overflow-hidden rounded-[3px] border border-[#a6adb3] bg-white"><div className="flex h-[35px] border-b border-[#a6adb3] bg-[#f0f0ee]"><button onClick={() => setActiveTab('new')} className={`flex-1 border-r border-[#a6adb3] px-2 text-[14px] font-bold ${activeTab === 'new' ? 'bg-white text-[#003865]' : 'text-[#003865]/80'}`}>New Quote</button><button onClick={() => setActiveTab('existing')} className={`flex-1 px-2 text-[14px] font-bold ${activeTab === 'existing' ? 'bg-white text-[#003865]' : 'text-[#003865]/80'}`}>Existing Quote</button></div><div className="grid grid-cols-[50px_1fr] items-center gap-2 p-3 text-[10px] text-[#003865]"><span className="font-bold">{activeTab === 'new' ? 'State' : 'Quote'}</span>{activeTab === 'new' ? <select aria-label="Quote state" value={state.ui.quoteState} onChange={(event) => setQuoteState(event.target.value as StateName)} className="h-[27px] rounded border border-[#cbd5df] bg-white px-2 text-[11px] text-[#2e3a43]">{SUPPORTED_STATES.map((name) => <option key={name}>{name}</option>)}</select> : !hasExisting ? <select className="h-[27px] rounded border border-[#cbd5df] bg-white px-2 text-[11px] text-[#7b8995]"><option>Find existing quote</option></select> : <select aria-label="Existing quote" value={choice} onChange={(event) => setPick(event.target.value as 'personal' | 'commercial')} className="h-[27px] rounded border border-[#cbd5df] bg-white px-2 text-[11px] text-[#2e3a43]">{existingQuote && <option value="personal">{existingQuote}</option>}{commercial && <option value="commercial">{commercial}</option>}</select>}<span /><button onClick={activeTab === 'new' ? onSelect : choice === 'commercial' ? openCommercial : onOpenExisting} disabled={activeTab === 'existing' && !hasExisting} className="h-[32px] rounded border-2 border-[#f26722] bg-[#003865] text-[14px] font-bold text-white shadow-[0_0_0_1px_#0073cf] hover:bg-[#005081]">{activeTab === 'new' ? 'Select Product(s)' : 'Open Quote'}</button></div></section>;
}

const GUIDE_PRODUCTS: [string, string][] = [['auto', 'Auto'], ['motorcycle', 'Motorcycle/ATV'], ['boat', 'Boat/PWC'], ['motorhome', 'Motor Home'], ['trailer', 'Travel Trailer'], ['snowmobile', 'Snowmobile'], ['renters', 'Renters (HO4)'], ['commercialAuto', 'Commercial Auto'], ['bop', 'Businessowners / Contractor GL'], ['mgmt', 'EPLI / NPDO / Cyber']];

function LeftColumn(quoteActions: QuoteActions) {
  const { openPage } = useQuote();
  const [showId, setShowId] = useState(true);
  return <aside className="space-y-4"><QuoteCard {...quoteActions} />
    <button type="button" onClick={() => openPage('support')} className="relative block w-full overflow-hidden rounded-[3px] bg-[#087dc1] px-3 py-3 text-center text-white shadow-sm hover:bg-[#0673b2]"><div className="absolute -left-4 top-0 h-full w-1/2 -skew-x-12 bg-white/10" /><div className="relative"><div className="text-[15px] font-bold">Training Center</div><p className="mt-1 text-[11px] font-semibold">Access all of our training pages here.</p></div></button>
    {showId && <div className="relative border border-[#003865] bg-white px-8 py-4 text-center text-[#101820] shadow-sm"><button onClick={() => setShowId(false)} aria-label="Dismiss unique ID" className="absolute right-1.5 top-1 text-[#003865] hover:text-[#e87722]"><X size={17} /></button><h2 className="text-[25px] font-bold tracking-[-1px] text-[#003865]">Agent ID</h2><p className="mt-3 text-[11px] font-bold leading-[1.45]">There is not a producer number assigned to your Agent ID. If you have an active appointment with us, please add it now for the most personalized experience on LAVA Training.</p><button type="button" onClick={() => openPage('agency')} className="mt-4 text-[11px] font-bold text-[#003865] underline decoration-[#e87722] decoration-2 underline-offset-2 hover:text-[#0073cf]">Add Producer Number</button></div>}
    <div className="relative overflow-hidden border border-[#a5c8d8] bg-[#dbf3fc] px-3 py-3 text-[#1d5e80] shadow-sm"><div className="flex items-start justify-between text-[20px] leading-[1.1]"><div>Product Guides and<br />Reference Cards</div><button type="button" aria-label="Open product guides" onClick={() => openPage('productGuides')}><Plus size={20} /></button></div><div className="mt-4 space-y-2 text-[10px] font-bold"><div>State</div><select aria-label="Guide state" value={guideRequest.state || 'North Carolina'} onChange={(event) => { guideRequest.state = event.target.value; }} className="h-[25px] w-full border border-[#93b7c9] bg-white px-2 text-[10px]">{SUPPORTED_STATES.map((name) => <option key={name}>{name}</option>)}</select><div>Product</div><select aria-label="Product guide" value="" onChange={(event) => { guideRequest.product = event.target.value; openPage('productGuides'); }} className="h-[25px] w-full border border-[#93b7c9] bg-white px-2 text-[10px]"><option value="">Select Product</option>{GUIDE_PRODUCTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
  </aside>;
}

function AlertsPanel() {
  const { state, openPolicies, openPending, openPage } = useQuote();
  const day = state.simDate;
  const count = (status: string) => state.policies.filter((policy) => matchesStatus(policy, status, day)).length;
  const today = parseDate(day)!;
  const month = new Date(today.getFullYear(), today.getMonth(), 2).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
  const statement = `${today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2}/5`;
  const recentClaims = claimsOf(state.policies).filter(({ claim }) => dayDiff(claim.reportedOn, day) <= 90).length;
  const sections: AlertSection[] = [
    { title: 'Admin Alerts', items: [{ text: `Production reports: ${month}`, onClick: () => openPage('production') }, { text: `Commission statement will be avail.: ${statement}`, onClick: () => openPage('commissions') }] },
    { title: 'Customer Communication Alerts', items: [{ text: 'Billing reminders', onClick: () => openPage('billing') }] },
    { title: 'Policy Level Alerts', items: [
      { text: `e-Sign follow-up required: ${count('e-Sign Pending')}`, onClick: () => openPage('esign') },
      { text: `Policies require follow up: ${count('Past Due')}`, onClick: () => openPage('billing') },
      { text: 'Policies pending cancel or renewal', onClick: () => openPending() },
      { text: `Save canceled or expired policies: ${prospects(state.policies).length}`, onClick: () => openPage('prospects') },
      { text: `Policies pending paperless enrollment: ${paperlessPending(state.policies)}`, onClick: () => openPolicies({ status: 'Active' }) },
    ] },
    { title: 'New Business & Prospecting', items: [{ text: `Requote prospects: ${prospects(state.policies).length}`, onClick: () => openPage('prospects') }, { text: `Cross-sell opportunities: ${crossSellOpportunities(state.policies).length}`, onClick: () => openPage('crossSell') }] },
    { title: 'Claims Alerts', items: [{ text: `Recent claims: ${recentClaims}`, onClick: () => openPage('claims') }] },
    { title: 'Customer Endorsements and ReWrites', items: [{ text: `Customer policy changes: ${recentChanges(state.policies, day)}`, onClick: () => openPolicies({ status: 'All' }) }, { text: `Rewrites/requotes: ${prospects(state.policies).length}`, onClick: () => openPage('prospects') }] },
  ];
  return <section className="min-w-0"><div className="flex items-center justify-between bg-[#087dc1] px-2 py-1.5 text-white"><h1 className="text-[15px] font-bold">LAVA Alerts</h1><button type="button" onClick={() => openPage('support')} className="flex items-center gap-1 text-[11px] font-bold underline"><CircleHelp size={13} /> What are LAVA Alerts?</button></div><div className="space-y-1.5 bg-white p-1.5">{sections.map((section) => <div key={section.title} className="border border-[#b9bcb9]"><div className="px-2 pb-0.5 pt-1.5 text-[11px] font-bold text-[#003865]">{section.title}</div><div className="grid grid-cols-1 gap-[3px] bg-white p-[3px] sm:grid-cols-2">{[...section.items, ...(section.items.length % 2 ? [{ text: '' }] : [])].map((item, index) => item.onClick ? <a key={item.text} href={`#${item.text.replace(/ /g, '-').toLowerCase()}`} onClick={(event) => { event.preventDefault(); item.onClick?.(); }} className="min-h-[26px] bg-[#f3f2ed] px-2 py-[5px] text-[11px] font-bold text-[#003865] underline decoration-[#003865] underline-offset-2 hover:text-[#0073cf]">{item.text}</a> : <span key={item.text || `empty-${index}`} className="min-h-[26px] bg-[#f3f2ed] px-2 py-[5px] text-[11px] text-[#28343c]">{item.text}</span>)}</div></div>)}</div></section>;
}

function PartnershipCard() {
  const { state } = useQuote();
  const autos = state.policies.filter((policy) => policy.product === 'auto' && inForce(policy));
  const prior = (value: string) => autos.filter((policy) => policy.source.kind === 'personal' && policy.source.quote.additional.continuousInsurance === value).length;
  const safe = autos.filter((policy) => policy.discounts.some((discount) => /homeowner|safe driver/i.test(discount))).length;
  return <section className="bg-[#f2f2f2] px-4 pb-3 pt-3 text-center text-[#003865] shadow-sm"><div className="mx-auto w-fit border border-[#72b0d1] px-2 py-0.5 text-[8px] tracking-[3px] text-[#087dc1]">LAVA AGENCY<br /><strong className="text-[20px] tracking-[2px]">GROWTH</strong></div><div className="mt-4 text-[15px] font-bold">INVESTMENT TIER</div><Gauge value={String(autos.length)} /><div className="mt-1 grid grid-cols-3 gap-1.5"><StatBox number={String(prior('No'))} label={<>NO PROOF<br />OF PRIOR</>} /><StatBox number={String(prior('Yes'))} label={<>PROOF<br />OF PRIOR</>} /><StatBox number={String(safe)} label={<>SAFE DRIVER<br />&amp; HOMEOWNER</>} /></div></section>;
}
// Segmented horseshoe gauge: three dark tiers and one light tier, open at the bottom.
const GAUGE_R = 47;
const GAUGE_C = 2 * Math.PI * GAUGE_R;
const GAUGE_SWEEP = 0.75;
const gaugeSegments: [number, number, string][] = [[0, 0.31, '#345876'], [0.32, 0.58, '#345876'], [0.59, 0.78, '#345876'], [0.79, 1, '#dfe5eb']];
function Gauge({ value }: { value: string }) { return <div className="relative mx-auto mt-1 h-[143px] w-[143px]"><svg viewBox="0 0 120 120" className="h-full w-full rotate-[135deg]">{gaugeSegments.map(([from, to, color]) => <circle key={from} cx="60" cy="60" r={GAUGE_R} fill="none" stroke={color} strokeWidth="17" strokeDasharray={`${(to - from) * GAUGE_SWEEP * GAUGE_C} ${GAUGE_C}`} strokeDashoffset={-from * GAUGE_SWEEP * GAUGE_C} />)}</svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="-mt-1 text-[32px] font-bold leading-none text-[#345876]">{value}</span><span className="mt-[34px] w-[78px] text-[6.5px] font-bold leading-[1.2]">CURRENT TOTAL AUTO<br />POLICIES IN FORCE</span></div></div>; }
function StatBox({ number, label }: { number: string; label: ReactNode }) { return <div className="rounded-[2px] bg-[#345876] px-1 py-1.5 text-white"><div className="text-[21px] font-bold leading-none">{number}</div><div className="mt-1 text-[7px] font-bold leading-[1.15]">{label}</div></div>; }
function BottomStats() {
  const { state } = useQuote();
  const total = state.policies.length;
  const active = state.policies.filter(inForce).length;
  const ring = 2 * Math.PI * 43;
  return <div className="flex items-center justify-between gap-2 px-2 pt-4 text-[#003865]"><div className="w-[96px] text-center text-[11px] font-bold leading-[1.35]">TOTAL ACCOUNT<br />POLICIES IN<br />FORCE</div><div className="relative h-[108px] w-[108px] shrink-0"><svg viewBox="0 0 120 120" className="h-full w-full -rotate-90"><circle cx="60" cy="60" r="43" fill="none" stroke="#d2d2d2" strokeWidth="14" /><circle cx="60" cy="60" r="43" fill="none" stroke="#f47721" strokeWidth="14" strokeDasharray={`${total ? (active / total) * ring : 0} ${ring}`} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[17px] font-bold">{active}</span><span className="text-[8px] font-bold">OF {total}</span></div></div></div>;
}
function AgencyNews() {
  const { openPage } = useQuote();
  return <section className="text-[#003865]"><h2 className="mb-3 text-[25px] font-light tracking-[-.5px]">Your Agency News</h2><article className="border border-[#b9bcb9] bg-white px-3 py-3 text-[11px] leading-[1.35] shadow-sm"><h3 className="font-bold">Exciting changes coming to LAVA Training on January 22!</h3><p className="mt-1">We're happy to announce some important updates to the LAVA Training portal, available on January 22, 2026. These enhancements are designed to empower agents with greater control over licensing requests and streamline processes.</p><button type="button" onClick={() => openPage('news')} className="mt-2 font-bold underline decoration-[#e87722] underline-offset-2 hover:text-[#0073cf]">Read more</button></article><article className="mt-2 border border-[#b9bcb9] bg-white px-3 py-3 text-[11px] leading-[1.35] shadow-sm"><h3 className="font-bold">The latest news and resources for your agency</h3><p className="mt-1">Find helpful tools, announcements, and updates created to support your agency.</p><button type="button" onClick={() => openPage('news')} className="mt-2 font-bold underline decoration-[#e87722] underline-offset-2 hover:text-[#0073cf]">View all agency news</button></article></section>;
}

// Page-level notice the portal shows while products are being selected (it sits under the modal overlay).
function BindingBanner() { return <div className="bg-[#1d252b] px-3 py-[3px] text-[11px] text-white"><span className="text-[13px]">Binding Restrictions:</span> Due to wildfires in multiple states writing new business, making endorsements, or changing limits on existing policies may be unavailable in affected areas. <LegalLink label="Binding Restrictions" className="font-bold underline" /></div>; }

export function Dashboard({ onSelectProduct, onOpenExisting, existingQuote, showBindingBanner = false }: { onSelectProduct: () => void; onOpenExisting: () => void; existingQuote: string; showBindingBanner?: boolean }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
  return <>{showBindingBanner && <BindingBanner />}<Header /><SearchBar /><main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(0,1fr)_240px] xl:grid-cols-[235px_minmax(0,1fr)_250px]"><LeftColumn onSelect={onSelectProduct} onOpenExisting={onOpenExisting} existingQuote={existingQuote} /><div className="space-y-3"><AlertsPanel /><AgencyNews /></div><aside className="space-y-3"><PartnershipCard /><BottomStats /></aside></main><footer className="mx-auto flex max-w-[1440px] justify-between px-4 pb-4 text-[10px] text-[#667582]"><span><FileText size={12} className="mr-1 inline" /> Agent portal dashboard</span><span>Last login: {formatLogin(session.lastLogin)}</span></footer><p className="mx-auto max-w-[1440px] px-4 pb-4 text-[10px] text-[#667582]">© {new Date().getFullYear()} LAVA Automation. LAVA Training is an independent agent training simulator by LAVA Automation. It is not affiliated with, endorsed by, or sponsored by Progressive Casualty Insurance Company or any of its affiliates. Training simulation only: no real insurance is quoted, bound or issued.</p></>;
}
