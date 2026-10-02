// Policy and Coverages left drawer: find another policy, the household's opened policies, and
// account-level links (new quotes, visual preferences, log out).
import { useState, type FormEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, FilePlus2, LayoutDashboard, LogOut, Search, Settings } from 'lucide-react';
import type { PolicyRecord } from '@/types/policy';
import { useQuote } from '@/context/useQuote';
import { NotificationBell } from '@/components/NotificationBell';
import { signOut } from '@/services/session';
import { productLabel } from '@/products/configs';
import { POLICY_ICONS, customerSince, shortDate } from '@/servicing/portal/portalUtils';
import { household, queryFromText, resolveSearch, roleFor, stateCode, statusText } from '@/servicing/account/accountModel';
const focus = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';

function DrawerLink({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-[10px] border-t border-[#dde3e8] px-[16px] py-[13px] text-left text-[12px] text-[#1f2a33] hover:bg-[#f2f5f8] hover:text-[#0073cf] ${focus}`}>{icon}{children}</button>;
}

export function AccountDrawer({ policy, open, onToggle, onNewQuotes, onPreferences, hubOpen, onToggleHub }: { policy: PolicyRecord; open: boolean; onToggle: () => void; onNewQuotes: () => void; onPreferences: () => void; hubOpen: boolean; onToggleHub: () => void }) {
  const { state, openAccount, openPolicies, showDashboard } = useQuote();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const policies = household(state.policies, policy);
  const since = customerSince(policies.filter((entry) => entry.insured.name === policy.insured.name));
  const find = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) { setError('Enter a name or policy number.'); return; }
    const query = queryFromText(text);
    const outcome = resolveSearch(state.policies, query, state.simDate);
    if (outcome.kind === 'none') { setError(`No policies found for "${text.trim()}".`); return; }
    setError('');
    if (outcome.kind === 'account') openAccount(outcome.policyId);
    else openPolicies(query);
  };
  const tab = <button type="button" onClick={onToggle} aria-label={open ? 'Collapse the policy drawer' : 'Expand the policy drawer'} aria-expanded={open} className={`absolute top-[18px] z-10 flex h-[40px] w-[30px] items-center justify-center rounded-r-[4px] border border-l-0 border-[#d0d7de] bg-white text-[#0073cf] shadow-sm hover:bg-[#f2f5f8] ${focus} ${open ? 'left-[230px]' : 'left-0'}`}>{open ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}</button>;
  if (!open) return <div className="account-drawer relative w-0 shrink-0 print:hidden">{tab}</div>;
  // With the policy menu open, the collapse tab moves aside (the menu has its own close button).
  return <aside aria-label="Policies" className="account-drawer relative flex w-[230px] shrink-0 flex-col border-r border-[#d0d7de] bg-white print:hidden">
    {!hubOpen && tab}
    <div className="flex h-[63px] shrink-0 items-center justify-between bg-[#0b2c56] pl-[18px] pr-[16px]">
      <button type="button" onClick={showDashboard} title="Return to dashboard" className={`text-[19px] font-light tracking-[-.5px] text-white ${focus}`}>LAVA<b className="font-bold">TRAINING</b></button>
      <NotificationBell align="left" />
    </div>
    {since && <p className="pt-[12px] text-center text-[11px] text-[#1f2a33]">Customer since {since}</p>}
    <form onSubmit={find} className={`border-b border-[#dde3e8] px-[16px] pb-[14px] ${since ? 'pt-[10px]' : 'pt-[16px]'}`}>
      <label className="sr-only" htmlFor="drawer-search">Enter a name or policy number</label>
      <input id="drawer-search" value={text} onChange={(event) => { setText(event.target.value); setError(''); }} placeholder="Enter a name or policy #" className="h-[34px] w-full rounded-[3px] border border-[#8b98a3] px-[10px] text-[12.5px] text-[#1f2a33] outline-none placeholder:text-[#6b7781] focus:border-[#0073cf] focus:shadow-[0_0_0_1px_#0073cf]" />
      <button type="submit" className={`mt-[10px] flex h-[34px] w-full items-center justify-center gap-[8px] rounded-[3px] bg-[#0073cf] text-[12.5px] font-bold text-white hover:bg-[#0056b3] ${focus}`}>Find Policy<Search size={14} /></button>
      {error && <p role="alert" className="mt-[6px] text-[11.5px] text-[#9e0012]">{error}</p>}
    </form>
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {policies.map((entry) => {
        const Icon = POLICY_ICONS[entry.product];
        const opened = entry.id === policy.id;
        return <li key={entry.id} className={`border-b border-[#dde3e8] ${opened ? 'bg-[#f2f5f8]' : ''}`}>
          <button type="button" aria-current={opened ? 'page' : undefined} onClick={() => { if (opened) onToggleHub(); else openAccount(entry.id); }} aria-expanded={opened ? hubOpen : undefined} title={opened ? 'Open the policy menu' : undefined} className={`grid w-full grid-cols-[42px_1fr] gap-[6px] px-[12px] py-[12px] text-left hover:bg-[#eef4f9] ${focus}`}>
            <span className="flex flex-col items-center pt-[2px] text-[#2f4a66]"><Icon size={24} strokeWidth={1.6} />{opened && <span className="mt-[3px] text-[10px] font-medium text-[#0073cf]">Opened</span>}</span>
            <span className="min-w-0 text-[11px] leading-[15px] text-[#1f2a33]">
              <span className="block truncate text-[12.5px] font-bold">{entry.insured.name}</span>
              <span className="block truncate border-b border-[#1f2a33] pb-[3px] text-[12.5px] font-bold">{productLabel(entry.product)} {entry.policyNumber}</span>
              <span className="mt-[4px] block">{shortDate(entry.effectiveDate)} - {shortDate(entry.expirationDate)}</span>
              <span className="block">{roleFor(entry, policy)}</span>
              <span className="block">{statusText(entry)}, {stateCode(entry)}, {entry.agentCode.split(' ')[0]}</span>
            </span>
          </button>
        </li>;
      })}
      <li><DrawerLink icon={<FilePlus2 size={17} className="text-[#2f4a66]" />} onClick={onNewQuotes}>New Policy Quotes</DrawerLink></li>
    </ul>
    <div className="shrink-0">
      <DrawerLink icon={<LayoutDashboard size={17} className="text-[#2f4a66]" />} onClick={showDashboard}>Agent Dashboard</DrawerLink>
      <DrawerLink icon={<Settings size={17} className="text-[#2f4a66]" />} onClick={onPreferences}>Visual Preferences</DrawerLink>
      <DrawerLink icon={<LogOut size={17} className="text-[#2f4a66]" />} onClick={() => { if (window.confirm('Log out of LAVA Training?')) signOut('manual'); }}>Log Out of LAVA Training</DrawerLink>
    </div>
  </aside>;
}
