// Notification bell: the account's activity feed (everything done under this login) plus the
// policies that need action today. Shown in every portal header.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bell } from 'lucide-react';
import { ACTIVITY_ICONS, useOpenActivity } from '@/components/activityUi';
import { useQuote } from '@/context/useQuote';
import { activityStore, markRead, timeAgo } from '@/services/activity';
import { matchesStatus } from '@/servicing/policyFilters';
import { claimsOf } from '@/servicing/portal/bookStats';

/** `align` sets which edge the dropdown lines up with (left when the bell sits near the left edge). */
export function NotificationBell({ tone = 'dark', align = 'right' }: { tone?: 'dark' | 'light'; align?: 'left' | 'right' }) {
  const { state, openPending, openPage } = useQuote();
  const entries = useSyncExternalStore(activityStore.subscribe, activityStore.get);
  const open = useOpenActivity();
  const [show, setShow] = useState(false);
  const [tab, setTab] = useState<'activity' | 'action'>('activity');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!show) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setShow(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [show]);
  const unread = entries.filter((entry) => !entry.read).length;
  const day = state.simDate;
  const count = (status: string) => state.policies.filter((policy) => matchesStatus(policy, status, day)).length;
  const openClaims = claimsOf(state.policies).filter(({ claim }) => claim.status.startsWith('Open')).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const actions = [
    { text: plural(count('Pending Cancel'), 'policy pending cancellation', 'policies pending cancellation'), n: count('Pending Cancel'), onClick: () => openPending() },
    { text: plural(count('Renewal Offered'), 'renewal offer waiting for payment', 'renewal offers waiting for payment'), n: count('Renewal Offered'), onClick: () => openPending('renewals') },
    { text: plural(count('Past Due'), 'past-due bill', 'past-due bills'), n: count('Past Due'), onClick: () => openPage('billing') },
    { text: plural(openClaims, 'open claim', 'open claims'), n: openClaims, onClick: () => openPage('claims') },
    { text: plural(count('e-Sign Pending'), 'application waiting for e-Signature', 'applications waiting for e-Signature'), n: count('e-Sign Pending'), onClick: () => openPage('esign') },
  ].filter((entry) => entry.n > 0);
  const badge = unread + actions.length;
  const iconTone = tone === 'dark' ? 'text-white hover:text-[#f5a45d]' : 'text-[#003865] hover:text-[#0073cf]';
  return <div ref={box} className="relative">
    <button type="button" aria-label={`Notifications (${unread} unread)`} aria-expanded={show} onClick={() => { setShow(!show); setTab(unread ? 'activity' : actions.length ? 'action' : 'activity'); }} className={`relative flex items-center ${iconTone}`}>
      <Bell size={18} />
      {badge > 0 && <span className="absolute -right-[7px] -top-[7px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#e8242b] px-[3px] text-[9px] font-bold leading-none text-white">{badge > 9 ? '9+' : badge}</span>}
    </button>
    {show && <div role="dialog" aria-label="Notifications" className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-[30px] z-[70] w-[380px] rounded-[3px] border border-[#a6adb3] bg-white text-left text-[#1b2a36] shadow-xl`}>
      <div className="flex items-center justify-between border-b border-[#e4ecf1] px-3 py-2"><span className="text-[13px] font-bold text-[#003865]">Notifications</span>{unread > 0 && <button type="button" onClick={() => markRead()} className="text-[11px] font-bold text-[#0073cf] underline">Mark all as read</button>}</div>
      <div role="tablist" className="flex border-b border-[#e4ecf1] text-[11.5px] font-bold">{([['activity', `Activity${unread ? ` (${unread})` : ''}`], ['action', `Action needed${actions.length ? ` (${actions.length})` : ''}`]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex-1 py-2 ${tab === key ? 'border-b-2 border-[#0073cf] text-[#003865]' : 'text-[#5c6670] hover:text-[#003865]'}`}>{label}</button>)}</div>
      <div className="max-h-[380px] overflow-y-auto">
        {tab === 'activity' && (entries.length ? entries.slice(0, 25).map((entry) => { const Icon = ACTIVITY_ICONS[entry.kind]; return <button key={entry.id} type="button" onClick={() => { setShow(false); open(entry); }} className={`flex w-full gap-3 border-b border-[#f0f3f5] px-3 py-[9px] text-left hover:bg-[#f3f9fc] ${entry.read ? '' : 'bg-[#f2f8fd]'}`}>
          <Icon size={17} className="mt-[2px] shrink-0 text-[#0073cf]" />
          <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><span className="truncate text-[12px] font-bold">{entry.title}</span><span className="shrink-0 text-[10px] text-[#7b858a]">{timeAgo(entry.at)}</span></span><span className="line-clamp-2 block text-[11px] leading-[15px] text-[#3d4b55]">{entry.detail}</span><span className="block text-[10px] text-[#7b858a]">by {entry.by}</span></span>
          {!entry.read && <span className="mt-[6px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#0073cf]" aria-label="Unread" />}
        </button>; }) : <p className="px-3 py-4 text-[12px] text-[#5c6670]">No activity yet. Quotes, binds, documents, payments and policy changes made under this login appear here.</p>)}
        {tab === 'action' && (actions.length ? actions.map((entry) => <button key={entry.text} type="button" onClick={() => { setShow(false); entry.onClick(); }} className="block w-full border-b border-[#f0f3f5] px-3 py-[10px] text-left text-[12px] font-bold text-[#003865] hover:bg-[#f3f9fc]">{entry.text}</button>) : <p className="px-3 py-4 text-[12px] text-[#5c6670]">You&rsquo;re all caught up.</p>)}
      </div>
      <button type="button" onClick={() => { setShow(false); openPage('activity'); }} className="block w-full border-t border-[#e4ecf1] py-2 text-center text-[11.5px] font-bold text-[#0073cf] hover:bg-[#f3f9fc]">View all activity</button>
    </div>}
  </div>;
}
