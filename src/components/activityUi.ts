// Shared pieces for the notification bell and the Activity Log page.
import { BadgeCheck, Car, CircleAlert, CreditCard, FileText, KeyRound, PencilLine, RefreshCcw, Receipt, ShieldAlert, Siren, type LucideIcon } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { markRead, type ActivityEntry, type ActivityKind } from '@/services/activity';
import type { PortalPage } from '@/context/quoteStore';
import { useOpenAccount } from '@/servicing/account/useOpenAccount';

export const ACTIVITY_ICONS: Record<ActivityKind, LucideIcon> = { quote: Car, bind: BadgeCheck, document: FileText, payment: CreditCard, change: PencilLine, claim: Siren, cancel: ShieldAlert, renewal: RefreshCcw, billing: Receipt, system: CircleAlert, account: KeyRound };

/** Opens whatever an activity entry points at. */
export function useOpenActivity() {
  const { state, openCustomer, openProof, openPage, goToStep, openCommercial } = useQuote();
  const openAccount = useOpenAccount();
  return (entry: ActivityEntry) => {
    markRead(entry.id);
    const target = entry.target;
    if (!target) return;
    const exists = !target.policyId || state.policies.some((policy) => policy.id === target.policyId);
    if (!exists) return;
    if (target.view === 'policy' && target.policyId) openAccount(target.policyId);
    else if (target.view === 'proof' && target.policyId) openProof(target.policyId);
    else if (target.view === 'customer' && target.customerKey) openCustomer(target.customerKey);
    else if (target.view === 'page' && target.page) openPage(target.page as PortalPage);
    else if (target.view === 'wizard') goToStep(state.ui.step);
    else if (target.view === 'commercial') openCommercial();
  };
}
