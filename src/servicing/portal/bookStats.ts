// Book-of-business figures used by the dashboard and the agency pages (all computed from the
// policies in this browser, never hard-coded).
import type { ClaimRecord, PolicyRecord } from '@/types/policy';
import { dayDiff } from '@/services/policyEngine';
import { customerKey } from '@/servicing/policyFilters';

export const inForce = (policy: PolicyRecord) => policy.status === 'Active' || policy.status === 'Pending Cancel';

export function claimsOf(policies: PolicyRecord[]): { claim: ClaimRecord; policy: PolicyRecord }[] {
  return policies.flatMap((policy) => (policy.claims ?? []).map((claim) => ({ claim, policy }))).sort((a, b) => dayDiff(a.claim.reportedOn, b.claim.reportedOn));
}

export function recentChanges(policies: PolicyRecord[], day: string, days = 30): number {
  return policies.reduce((sum, policy) => sum + policy.history.filter((entry) => entry.event === 'Policy change processed' && dayDiff(entry.date, day) <= days && dayDiff(entry.date, day) >= 0).length, 0);
}

/** Former customers to win back: cancelled, expired or non-renewed policies. */
export const prospects = (policies: PolicyRecord[]) => policies.filter((policy) => policy.status === 'Cancelled' || policy.status === 'Expired' || policy.status === 'Non-Renewed');

export interface CrossSell { key: string; name: string; policy: PolicyRecord; has: string[]; offer: 'renters' | 'auto' | 'motorcycle' }

/** Personal-lines customers missing a product that pairs with what they have. */
export function crossSellOpportunities(policies: PolicyRecord[]): CrossSell[] {
  const customers = new Map<string, PolicyRecord[]>();
  for (const policy of policies.filter((entry) => inForce(entry) && entry.source.kind === 'personal')) customers.set(customerKey(policy), [...(customers.get(customerKey(policy)) ?? []), policy]);
  return [...customers.entries()].flatMap(([key, list]) => {
    const products = list.map((policy) => policy.product);
    const offer = !products.includes('auto') ? 'auto' : !products.includes('renters') ? 'renters' : !products.includes('motorcycle') ? 'motorcycle' : null;
    return offer ? [{ key, name: list[0].insured.name, policy: list[0], has: list.map((policy) => policy.productName), offer }] : [];
  });
}

export function paperlessPending(policies: PolicyRecord[]): number {
  return policies.filter((policy) => inForce(policy) && policy.source.kind === 'personal' && policy.source.quote.additional.paperless !== 'Yes').length;
}

/** Written premium on new business and renewals issued in the month of `day` (MM/DD/YYYY). */
export function monthKey(day: string): string {
  return `${day.slice(6)}-${day.slice(0, 2)}`;
}
