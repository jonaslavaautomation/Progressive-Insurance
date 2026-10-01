// Policy and Coverages: what the account page derives from a policy record (household, alerts,
// billing summary, people, coverage rows). Pure functions, no React.
import type { CoverageLine, PolicyRecord, UnitSnapshot } from '@/types/policy';
import type { Driver } from '@/types/quote';
import type { PolicyQuery } from '@/context/quoteStore';
import { REINSTATEMENT_WINDOW_DAYS, balance, dayDiff, minimumDue, nextInstallment, reinstatementCheck, shiftDate } from '@/services/policyEngine';
import { filterPolicies } from '@/servicing/policyFilters';
import { rulesFor } from '@/data/states';
import { formatCurrency } from '@/utils/masks';
import { parseDate } from '@/utils/dates';

const round2 = (value: number) => Math.round(value * 100) / 100;
const lower = (value: string) => value.trim().toLowerCase();

/** "09/28/1983" -> "September 28, 1983". */
export function longDate(date: string): string {
  const parsed = parseDate(date);
  return parsed ? parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : date || '—';
}

const householdKey = (policy: PolicyRecord) => `${lower(policy.insured.street)}|${lower(policy.insured.cityStateZip)}`;
const samePerson = (a: PolicyRecord, b: PolicyRecord) => lower(a.insured.name) === lower(b.insured.name) && householdKey(a) === householdKey(b);
const inForce = (policy: PolicyRecord) => policy.status === 'Active' || policy.status === 'Pending Cancel';

/** Every policy at the customer's mailing address: theirs first, then other household members'. */
export function household(policies: PolicyRecord[], policy: PolicyRecord): PolicyRecord[] {
  const key = householdKey(policy);
  const rank = (entry: PolicyRecord) => (samePerson(entry, policy) ? 0 : 2) + (inForce(entry) ? 0 : 1);
  return policies.filter((entry) => householdKey(entry) === key).sort((a, b) => rank(a) - rank(b) || dayDiff(a.effectiveDate, b.effectiveDate));
}

/** The policy a customer search opens: their in-force auto policy, else any in-force, else the newest. */
export function primaryPolicy(policies: PolicyRecord[]): PolicyRecord | undefined {
  const score = (policy: PolicyRecord) => (inForce(policy) ? 0 : 2) + (policy.product === 'auto' ? 0 : 1);
  return [...policies].sort((a, b) => score(a) - score(b) || dayDiff(a.effectiveDate, b.effectiveDate))[0];
}

export type SearchOutcome = { kind: 'account'; policyId: string } | { kind: 'list' } | { kind: 'none' };

/**
 * Policy number, last name or first + last name all resolve the same way: one customer opens their
 * account; several customers open the result list; nothing found stays on the page.
 */
export function resolveSearch(policies: PolicyRecord[], query: PolicyQuery, day: string): SearchOutcome {
  const matches = filterPolicies(policies, query, day);
  if (!matches.length) return { kind: 'none' };
  if (query.mode === 'Policy' && query.policyNumber.trim()) {
    const exact = matches.find((policy) => policy.policyNumber === query.policyNumber.trim());
    if (exact) return { kind: 'account', policyId: exact.id };
  }
  const people = new Set(matches.map((policy) => `${lower(policy.insured.name)}|${householdKey(policy)}`));
  if (people.size === 1) return { kind: 'account', policyId: (query.mode === 'Policy' && matches.length === 1 ? matches[0] : primaryPolicy(matches)!).id };
  return { kind: 'list' };
}

export const SEARCH_ACTIONS = ['Policy Summary', 'Billing and Payments', 'Documents', 'Policy Activity', 'ID Cards and Proof'] as const;
export type SearchAction = (typeof SEARCH_ACTIONS)[number];

/** The drawer's free-text box: digits search policy numbers, words search "Last" or "First Last". */
export function queryFromText(text: string): PolicyQuery {
  const value = text.trim();
  const base: PolicyQuery = { mode: 'Customer', lastName: '', firstName: '', policyNumber: '', product: 'All', status: 'All' };
  if (/^\d[\d\s-]*$/.test(value)) return { ...base, mode: 'Policy', policyNumber: value.replace(/\D/g, '') };
  const words = value.split(/[\s,]+/).filter(Boolean);
  if (value.includes(',')) return { ...base, lastName: words[0] ?? '', firstName: words[1] ?? '' };
  return words.length > 1 ? { ...base, firstName: words[0], lastName: words[words.length - 1] } : { ...base, lastName: words[0] ?? '' };
}

/** How the drawer describes a household member's relationship to the customer being viewed. */
export function roleFor(entry: PolicyRecord, viewed: PolicyRecord): string {
  if (samePerson(entry, viewed)) return 'Primary named insured';
  const driver = driversOf(viewed).find((person) => lower(`${person.firstName} ${person.lastName}`) === lower(entry.insured.name));
  return driver?.relationship && driver.relationship !== 'Insured' ? driver.relationship : 'Household member';
}

export function statusText(policy: PolicyRecord): string {
  if (policy.status === 'Cancelled') {
    const kind = policy.cancellation?.kind;
    return kind === 'insured' ? 'Canceled due to insured request' : kind === 'nonpayment' ? 'Canceled for nonpayment' : 'Canceled by company';
  }
  return { Active: 'Active', 'Pending Cancel': 'Pending cancel', Expired: 'Expired', 'Non-Renewed': 'Non-renewed' }[policy.status];
}

export const zipOf = (policy: PolicyRecord) => policy.insured.cityStateZip.split(' ').pop() ?? '';
export const stateCode = (policy: PolicyRecord) => rulesFor(policy.state).code;

export function driversOf(policy: PolicyRecord): Driver[] {
  return policy.source.kind === 'personal' ? policy.source.quote.drivers.filter((driver) => driver.firstName || driver.lastName) : [];
}

/** Earliest policy start for this customer at this address (full date). */
export function customerSinceDate(policies: PolicyRecord[], policy: PolicyRecord): string {
  const dates = policies.filter((entry) => samePerson(entry, policy)).map((entry) => entry.issuedOn || entry.effectiveDate);
  return dates.sort((a, b) => dayDiff(b, a))[0] ?? policy.effectiveDate;
}

export const LOYALTY_LEVELS = [
  { name: 'Bronze', years: 0, perk: 'Welcome level for new customers.' },
  { name: 'Silver', years: 1, perk: 'Small accident forgiveness after one claim-free year.' },
  { name: 'Gold', years: 3, perk: 'Large accident forgiveness and a renewal loyalty credit.' },
  { name: 'Platinum', years: 5, perk: 'Every Gold benefit plus a dedicated service line.' },
] as const;

/** Training rule: loyalty grows with years as a customer. */
export function loyaltyLevel(since: string, day: string) {
  const years = dayDiff(since, day) / 365;
  return [...LOYALTY_LEVELS].reverse().find((level) => years >= level.years) ?? LOYALTY_LEVELS[0];
}

/** Bullets for the pink "Important Messages" banner. */
export function importantMessages(policy: PolicyRecord, day: string): string[] {
  const messages: string[] = [];
  const renewal = policy.renewal;
  if (renewal) {
    const change = round2(renewal.premium - renewal.previousPremium);
    if (change < 0) messages.push(`Congrats, your renewal rate went down by ${formatCurrency(-change)}!`);
    else if (change > 0) messages.push(`Your renewal rate went up by ${formatCurrency(change)}. ${renewal.reasons[0] ? renewal.reasons[0].replace(/\.?$/, '.') : 'See Policy Activity for the reasons.'}`);
    else messages.push('Your renewal rate is unchanged.');
    if (renewal.status === 'Offered') messages.push(`The renewal down payment of ${formatCurrency(renewal.dueToday)} is due by ${renewal.effectiveDate} to renew for ${renewal.effectiveDate} – ${renewal.expirationDate}.`);
  }
  if (policy.pendingCancel) {
    const notice = policy.pendingCancel;
    messages.push(notice.kind === 'nonpayment' ? `This policy will cancel on ${notice.effectiveDate} for nonpayment. Pay ${formatCurrency(minimumDue(policy, day))} before then to keep coverage.` : `This policy is pending cancellation effective ${notice.effectiveDate}: ${notice.reason}.`);
  } else if (policy.status === 'Active' && minimumDue(policy, day) > 0) {
    messages.push(`A payment of ${formatCurrency(minimumDue(policy, day))} is past due.`);
  }
  if (policy.status === 'Active' && !policy.pendingCancel && !policy.nonRenewal) {
    const automatic = policy.autopay || policy.billPlanId === 'PIF' && /EFT|bank/i.test(policy.paymentMethod);
    messages.push(`The current policy term will expire on ${policy.expirationDate}.${automatic ? ' This policy is on an EFT/Direct Payment bill plan and will automatically renew.' : renewal ? '' : ' A renewal offer is sent about 30 days before the term ends.'}`);
  }
  if (policy.nonRenewal) messages.push(`This policy will not renew. Coverage ends on ${policy.expirationDate} (${policy.nonRenewal.reason}).`);
  if (policy.status === 'Cancelled' && policy.cancellation) {
    const check = reinstatementCheck(policy, day);
    messages.push(`This policy was canceled effective ${policy.cancellation.effectiveDate}: ${policy.cancellation.reason}.${check.allowed ? ` It can be reinstated until ${shiftDate(policy.cancellation.effectiveDate, REINSTATEMENT_WINDOW_DAYS)}.` : ''}`);
  }
  if (policy.status === 'Expired') messages.push(`This policy expired on ${policy.expirationDate}.`);
  if (policy.esign === 'Pending' && policy.status !== 'Cancelled') messages.push('e-Sign follow-up required: the customer has not signed the application.');
  for (const claim of policy.claims ?? []) if (claim.status.startsWith('Open')) messages.push(`Claim #${claim.claimNumber} (${claim.type}) is open and assigned to ${claim.adjuster}.`);
  return messages;
}

export function billingStatus(policy: PolicyRecord, day: string): string {
  if (policy.status === 'Cancelled') return balance(policy) > 0 ? 'Canceled, balance due' : 'Canceled';
  if (policy.pendingCancel) return 'Pending cancellation';
  if (minimumDue(policy, day) > 0) return 'Past due';
  if (balance(policy) <= 0.005) return 'Paid in full';
  return 'Current';
}

export function lastPayment(policy: PolicyRecord): { amount: number; date: string } | null {
  const entry = [...policy.ledger].reverse().find((item) => item.type === 'Payment' || item.type === 'Automatic Payment');
  return entry ? { amount: -entry.amount, date: entry.date } : null;
}

export function paymentMethodLabel(method: string): string {
  if (/EFT|bank/i.test(method)) return 'Electronic Funds Transfer';
  if (/card/i.test(method)) return 'Credit/Debit Card';
  if (/check/i.test(method)) return 'Check';
  return method || '—';
}

/** Right-hand text in Billing and Payments: the renewal or next amount due. */
export function amountDueText(policy: PolicyRecord): string {
  if (policy.renewal) return `Renewal amount due on ${policy.renewal.effectiveDate}: ${formatCurrency(policy.renewal.status === 'Offered' ? policy.renewal.dueToday : policy.renewal.premium)}`;
  if (policy.status === 'Cancelled') return policy.cancellation && policy.cancellation.balanceDue > 0 ? `Earned premium due: ${formatCurrency(policy.cancellation.balanceDue)}` : 'No amount due.';
  const next = nextInstallment(policy);
  if (next && next.amount - next.paid > 0.005) return `Next amount due on ${next.due}: ${formatCurrency(next.amount - next.paid)}`;
  return policy.status === 'Active' ? `Renewal offer available about 30 days before ${policy.expirationDate}.` : 'No amount due.';
}

/** Paperless state: the agent's latest change, else what the customer chose at issue. */
export function paperlessOf(policy: PolicyRecord): { enrolled: boolean; changedOn: string; reason: string } {
  if (policy.paperless) return policy.paperless;
  const chose = policy.source.kind === 'personal' && policy.source.quote.additional.paperless === 'Yes';
  return { enrolled: chose, changedOn: policy.issuedOn || policy.effectiveDate, reason: chose ? 'Enrolled' : 'Not enrolled' };
}

export interface CoverageRow { label: string; value: string; premium: number; help: string }

const HELP: Record<string, string> = {
  'Bodily Injury & Property Damage Liability': "Pays for injuries and damage the driver causes to other people and their property, up to the limits shown. Required by state law.",
  'Uninsured/Underinsured Motorist': 'Pays for injuries to the insured household when the at-fault driver has no insurance or not enough insurance.',
  'Uninsured Motorist Property Damage': 'Pays for damage to the insured vehicle caused by an uninsured driver.',
  'Personal Injury Protection': 'No-fault coverage for medical bills and lost wages for the insured, regardless of who caused the accident.',
  'Medical Payments': 'Pays medical bills for the driver and passengers after an accident, regardless of fault, up to the limit per person.',
  Comprehensive: 'Pays to repair or replace the vehicle after theft, fire, glass breakage, hail, flood or hitting an animal, minus the deductible.',
  Collision: 'Pays to repair the vehicle after it hits another vehicle or object, or rolls over, minus the deductible.',
  'LAVA Vehicle Protection': 'Training coverage: replaces a newer vehicle with a new one of the same make and model if it is totaled in the first years of ownership.',
  'Rental Reimbursement': 'Pays for a rental car while the vehicle is being repaired after a covered loss, up to the daily and total limits.',
  'Roadside Assistance': 'Towing, jump starts, flat tire changes, fuel delivery and lockout service.',
  'Custom Parts and/or Equipment value': 'Covers aftermarket parts and equipment, such as custom wheels or a stereo, up to the value shown.',
  'Loan/Lease Payoff': 'Pays the difference between the actual cash value and the loan or lease balance if a financed vehicle is totaled.',
};
export const coverageHelp = (label: string) => HELP[label] ?? 'Coverage details are in the policy contract and on the Declarations Page.';

const NONE = /^(none|no coverage|reject(ed)?|\$0|0|do not participate)$/i;
const valueOf = (line: CoverageLine | undefined) => (!line || NONE.test(line.value.trim()) ? 'No Coverage' : line.value);

/** One vehicle's coverages in carrier order; policy-level coverages are split across the vehicles. */
export function autoCoverageRows(policy: PolicyRecord, unit: UnitSnapshot, index: number): CoverageRow[] {
  const count = policy.units.length || 1;
  const find = (pattern: RegExp) => unit.coverages.find((line) => pattern.test(line.label));
  const share = (line: CoverageLine | undefined) => {
    if (!line?.premium) return 0;
    const each = round2(line.premium / count);
    return index === 0 ? round2(line.premium - each * (count - 1)) : each;
  };
  const policyLine = (pattern: RegExp) => policy.policyCoverages.find((line) => pattern.test(line.label));
  const row = (label: string, line: CoverageLine | undefined, premium = line?.premium ?? 0): CoverageRow => ({ label, value: valueOf(line), premium, help: coverageHelp(label) });
  const um = policyLine(/^Uninsured\/Underinsured/i);
  const umpd = policyLine(/Uninsured Motorist Property Damage/i);
  const pip = policyLine(/Personal Injury Protection/i);
  const year = Number(unit.label.slice(0, 4));
  const newer = year && parseDate(policy.effectiveDate) ? parseDate(policy.effectiveDate)!.getFullYear() - year <= 2 : false;
  const loan = policy.lienholders.some((entry) => entry.unit === unit.label);
  return [
    row('Bodily Injury & Property Damage Liability', find(/^Bodily Injury/i)),
    ...(um ? [row('Uninsured/Underinsured Motorist', um, share(um))] : []),
    ...(umpd ? [row('Uninsured Motorist Property Damage', umpd, share(umpd))] : []),
    ...(pip ? [row('Personal Injury Protection', pip, share(pip))] : []),
    row('Medical Payments', find(/^Medical/i)),
    row('Comprehensive', find(/Other Than Collision|Comprehensive/i)),
    row('Collision', find(/^Collision/i)),
    { label: 'LAVA Vehicle Protection', value: newer ? 'No Coverage' : 'Not Eligible', premium: 0, help: coverageHelp('LAVA Vehicle Protection') },
    row('Rental Reimbursement', find(/Transportation|Rental/i)),
    row('Roadside Assistance', find(/Towing|Roadside/i)),
    row('Custom Parts and/or Equipment value', find(/Customiz|Custom Parts/i)),
    { label: 'Loan/Lease Payoff', value: loan ? 'Not selected (vehicle is financed)' : 'No Coverage', premium: 0, help: coverageHelp('Loan/Lease Payoff') },
  ];
}

/** Rows for a non-auto unit (motorcycle, boat, renters...), as rated. */
export function unitCoverageRows(unit: UnitSnapshot): CoverageRow[] {
  return unit.coverages.map((line) => ({ label: line.label, value: valueOf(line), premium: line.premium ?? 0, help: coverageHelp(line.label) }));
}

export function rowsTotal(rows: CoverageRow[]): number {
  return round2(rows.reduce((sum, row) => sum + row.premium, 0));
}

/** The DriveSense (usage-based) line on an auto policy, if any. */
export function driveSense(policy: PolicyRecord): string {
  return policy.policyCoverages.find((line) => /DriveSense/i.test(line.label))?.value ?? '';
}
