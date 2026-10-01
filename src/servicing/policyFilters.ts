import type { PolicyRecord } from '@/types/policy';
import type { PolicyQuery } from '@/context/quoteStore';
import { minimumDue } from '@/services/policyEngine';

export const STATUS_FILTERS = ['All', 'Active', 'Pending Cancel', 'Cancelled', 'Expired', 'Non-Renewed', 'Renewal Offered', 'Past Due', 'e-Sign Pending'];
export const PRODUCT_FILTERS = [{ value: 'All', label: 'All' }, { value: 'auto', label: 'Auto' }, { value: 'motorcycle', label: 'Motorcycle/ATV' }, { value: 'boat', label: 'Boat/PWC' }, { value: 'motorhome', label: 'Motor Home' }, { value: 'trailer', label: 'Travel Trailer' }, { value: 'snowmobile', label: 'Snowmobile' }, { value: 'renters', label: 'Renters (HO4)' }];

/** Groups a customer's policies (same named insured at the same mailing address). */
export function customerKey(policy: PolicyRecord): string {
  return `${policy.insured.name}|${policy.insured.street}`.toLowerCase();
}

export function matchesStatus(policy: PolicyRecord, status: string, day: string): boolean {
  if (status === 'All') return true;
  if (status === 'Renewal Offered') return policy.renewal?.status === 'Offered';
  if (status === 'Past Due') return policy.status !== 'Cancelled' && minimumDue(policy, day) > 0;
  if (status === 'e-Sign Pending') return policy.esign === 'Pending';
  return policy.status === status;
}

export function filterPolicies(policies: PolicyRecord[], query: PolicyQuery, day: string): PolicyRecord[] {
  const text = (value: string) => value.trim().toLowerCase();
  return policies.filter((policy) => {
    if (query.mode === 'Policy' && query.policyNumber && !policy.policyNumber.includes(query.policyNumber.trim())) return false;
    if (query.mode === 'Customer' && query.lastName && !policy.insured.lastName.toLowerCase().startsWith(text(query.lastName))) return false;
    if (query.mode === 'Customer' && query.firstName && !policy.insured.firstName.toLowerCase().startsWith(text(query.firstName))) return false;
    if (query.product !== 'All' && policy.product !== query.product) return false;
    return matchesStatus(policy, query.status, day);
  });
}
