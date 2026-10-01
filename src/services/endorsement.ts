// Mid-term policy changes (endorsements): validate the change date, re-rate the edited source,
// prorate the premium difference and issue amended documents.
import type { PolicyRecord, PolicySource } from '@/types/policy';
import { rateSource } from '@/services/policyBuilder';
import { dayDiff, shiftDate } from '@/services/policyEngine';
import { parseDate } from '@/utils/dates';
import { rulesFor } from '@/data/states';

export const MAX_BACKDATE_DAYS = 30;
export const MAX_FUTURE_DAYS = 30;

const round2 = (value: number) => Math.round(value * 100) / 100;
const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function validateChangeDate(policy: PolicyRecord, effectiveDate: string, day: string, noLossConfirmed: boolean): string {
  if (policy.status !== 'Active') return `Changes can only be made to an active policy. This policy is ${policy.status}.`;
  if (!parseDate(effectiveDate)) return 'Enter a valid change effective date (MM/DD/YYYY).';
  if (dayDiff(policy.effectiveDate, effectiveDate) < 0) return `The change date cannot be before the policy effective date (${policy.effectiveDate}).`;
  if (dayDiff(effectiveDate, policy.expirationDate) <= 0) return `The change date must be before the policy expiration date (${policy.expirationDate}).`;
  if (dayDiff(effectiveDate, day) > MAX_BACKDATE_DAYS) return `Changes cannot be backdated more than ${MAX_BACKDATE_DAYS} days (earliest ${shiftDate(day, -MAX_BACKDATE_DAYS)}).`;
  if (dayDiff(day, effectiveDate) > MAX_FUTURE_DAYS) return `Changes cannot be dated more than ${MAX_FUTURE_DAYS} days in the future.`;
  if (dayDiff(effectiveDate, day) > 0 && !noLossConfirmed) return 'A backdated change requires the customer to confirm there have been no losses since the change date.';
  return '';
}

export interface ChangePreview {
  oldPlanTotal: number;
  newPlanTotal: number;
  termDays: number;
  remainingDays: number;
  prorated: number;
  newFullTerm: number;
  openInstallments: number;
  perInstallment: number;
}

/** Premium impact of replacing the policy's source with `draft` from `effectiveDate`. */
export function previewChange(policy: PolicyRecord, draft: PolicySource, effectiveDate: string): ChangePreview {
  const before = rateSource(policy.source, policy.product);
  const after = rateSource(draft, policy.product);
  const planOf = (plans: typeof before.plans) => plans.find((plan) => plan.id === policy.billPlanId) ?? plans[0];
  const oldPlanTotal = planOf(before.plans).total;
  const newPlanTotal = planOf(after.plans).total;
  const termDays = Math.max(1, dayDiff(policy.effectiveDate, policy.expirationDate));
  const remainingDays = Math.max(0, Math.min(termDays, dayDiff(effectiveDate, policy.expirationDate)));
  const prorated = round2((newPlanTotal - oldPlanTotal) * (remainingDays / termDays));
  const open = policy.installments.filter((entry) => entry.status === 'scheduled' || entry.status === 'billed');
  return { oldPlanTotal, newPlanTotal, termDays, remainingDays, prorated, newFullTerm: after.fullTermPremium, openInstallments: open.length, perInstallment: open.length ? round2(prorated / open.length) : 0 };
}

export interface ChangeRequest {
  draft: PolicySource;
  effectiveDate: string;
  changes: string[];
  vehiclesChanged: boolean;
  lienholders: PolicyRecord['lienholders'];
  newLienholders: PolicyRecord['lienholders'];
}

export function applyChange(policy: PolicyRecord, request: ChangeRequest, day: string): PolicyRecord {
  const preview = previewChange(policy, request.draft, request.effectiveDate);
  const rating = rateSource(request.draft, policy.product);
  const { prorated } = preview;
  const open = policy.installments.filter((entry) => entry.status === 'scheduled' || entry.status === 'billed');
  let installments = policy.installments;
  const ledger = [...policy.ledger];
  if (prorated !== 0) ledger.push({ id: id('led'), date: day, type: 'Endorsement', amount: prorated, detail: `Policy change effective ${request.effectiveDate}: ${request.changes.join('; ')}` });
  if (prorated !== 0 && open.length) {
    // Spread the difference across the remaining installments (the last one absorbs rounding).
    const share = round2(prorated / open.length);
    const last = open[open.length - 1].id;
    installments = policy.installments.map((entry) => (open.includes(entry) ? { ...entry, amount: round2(entry.amount + (entry.id === last ? prorated - share * (open.length - 1) : share)) } : entry));
  } else if (prorated > 0) {
    installments = [...policy.installments, { id: id('ins'), number: policy.installments.length, due: shiftDate(day, 20), amount: prorated, paid: 0, status: 'billed', billedOn: day, lateFeeApplied: false }];
  } else if (prorated < 0) {
    ledger.push({ id: id('led'), date: day, type: 'Refund', amount: -prorated, detail: 'Return premium from policy change, refunded to the original payment method' });
  }
  const source = request.draft;
  const insured = source.kind === 'personal'
    ? { ...policy.insured, email: source.quote.insured.email, phone: source.quote.insured.phones.find((entry) => entry.number)?.number ?? policy.insured.phone, street: [source.quote.insured.address.line1, source.quote.insured.address.line2].filter(Boolean).join(', '), cityStateZip: `${source.quote.insured.address.city}, ${source.quote.insured.address.state} ${source.quote.insured.address.zip}` }
    : { ...policy.insured, email: source.quote.business.email, phone: source.quote.business.phone, street: source.quote.business.street, cityStateZip: `${source.quote.business.city}, ${source.quote.business.state} ${source.quote.business.zip}` };
  const drivers = source.kind === 'personal' ? source.quote.drivers.filter((driver) => driver.driverStatus === 'Rated').map((driver) => [driver.firstName, driver.lastName].filter(Boolean).join(' ')) : source.quote.drivers.map((driver) => [driver.firstName, driver.lastName].filter(Boolean).join(' '));
  const documents = [...policy.documents, { id: id('doc'), type: 'Amended Declarations' as const, date: day, term: policy.termNumber, data: { changeEffective: request.effectiveDate, changes: request.changes.join('; '), prorated } }];
  if (request.vehiclesChanged && !['renters', 'boat', 'bop', 'mgmt'].includes(policy.product)) documents.push({ id: id('doc'), type: 'ID Cards', date: day, term: policy.termNumber, data: {} });
  if (request.vehiclesChanged && policy.product === 'auto' && rulesFor(policy.state).reporting?.system.includes('FS-1')) documents.push({ id: id('doc'), type: 'FS-1 Certificate of Insurance', date: day, term: policy.termNumber, data: { reason: 'Policy change' } });
  for (const holder of request.newLienholders) documents.push({ id: id('doc'), type: 'Evidence of Insurance', date: day, term: policy.termNumber, data: { name: holder.name, address: holder.address, loanNumber: holder.loanNumber, unit: holder.unit, kind: holder.kind } });
  return {
    ...policy,
    source,
    insured,
    drivers,
    units: rating.units,
    policyCoverages: rating.policyCoverages,
    discounts: rating.discounts,
    fullTermPremium: rating.fullTermPremium,
    termPremium: round2(policy.termPremium + prorated),
    installments,
    ledger,
    documents,
    lienholders: request.lienholders,
    // A pending renewal offer was priced on the old coverage; re-offer at the next clock run.
    renewal: null,
    history: [...policy.history, { id: id('his'), date: day, event: 'Policy change processed', detail: `Effective ${request.effectiveDate}: ${request.changes.join('; ')}. ${prorated > 0 ? `Additional premium $${prorated.toFixed(2)}` : prorated < 0 ? `Return premium $${(-prorated).toFixed(2)}` : 'No premium change'}.` }],
  };
}
