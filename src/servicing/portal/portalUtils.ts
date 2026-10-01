// Shared helpers for the Customer Summary and ID Cards / Proof of Insurance pages.
import { Snowflake, Bike, Building2, BriefcaseBusiness, Bus, Car, Caravan, Sailboat, Store, Truck, type LucideIcon } from 'lucide-react';
import type { PolicyDocument, PolicyRecord } from '@/types/policy';
import type { AnyProductKey } from '@/products/types';
import { parseDate } from '@/utils/dates';

export const POLICY_ICONS: Record<AnyProductKey, LucideIcon> = { snowmobile: Snowflake, auto: Car, motorcycle: Bike, boat: Sailboat, motorhome: Bus, trailer: Caravan, renters: Building2, commercialAuto: Truck, bop: Store, mgmt: BriefcaseBusiness };

/** Products that carry vehicle ID cards. */
export const hasIdCards = (policy: PolicyRecord) => !['renters', 'boat', 'bop', 'mgmt'].includes(policy.product);

export function customerSince(policies: PolicyRecord[]): string {
  const years = policies.map((policy) => Number(policy.issuedOn.slice(-4))).filter(Boolean);
  return years.length ? String(Math.min(...years)) : '';
}

export function formatLongDate(value: string): string {
  const parsed = parseDate(value);
  return parsed ? parsed.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : value;
}

export const shortDate = (value: string) => value.replace(/^(\d{2})\/(\d{2})\/\d{2}(\d{2})$/, '$1/$2/$3');

/** Most recent document of any of the given types for the current term. */
export function latestDocument(policy: PolicyRecord, types: PolicyDocument['type'][]): PolicyDocument | undefined {
  return [...policy.documents].reverse().find((document) => types.includes(document.type) && document.term === policy.termNumber)
    ?? [...policy.documents].reverse().find((document) => types.includes(document.type));
}

export const CLAIMS_LINE = '1-800-555-0199';

/** Product the dashboard's Product Guides picker asked for (read once by the guides page). */
export const guideRequest = { product: '', state: '' };
