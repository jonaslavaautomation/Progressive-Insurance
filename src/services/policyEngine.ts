// Policy servicing engine: billing cycle, late fees, state-compliant cancellation notices,
// cancellation/refund math, reinstatement and renewal. Pure functions over PolicyRecord.
import type { CancelKind, InstallmentRecord, LedgerEntry, LedgerType, PolicyDocumentType, PolicyRecord } from '@/types/policy';
import type { BillPlan } from '@/types/quote';
import { addDays, addMonths, daysBetween, formatDate, parseDate } from '@/utils/dates';
import { buildBillPlans } from '@/utils/ratingEngine';
import { rulesFor } from '@/data/states';

/** Notice periods for a policy's state. */
export const nonpaymentNoticeDays = (policy: PolicyRecord) => rulesFor(policy.state).nonpaymentNoticeDays;
export const otherNoticeDays = (policy: PolicyRecord) => rulesFor(policy.state).otherNoticeDays;
const filesFs1 = (policy: PolicyRecord) => policy.product === 'auto' && !!rulesFor(policy.state).reporting?.system.includes('FS-1');

export const BILL_LEAD_DAYS = 20;
/** Late fee applies when a payment is more than 2 days past its due date (Progressive installment filing). */
export const LATE_AFTER_DAYS = 2;
export const LATE_FEE = 25;
export const RETURNED_PAYMENT_FEE = 25;
/** Days past due before the carrier mails a notice of cancellation for nonpayment. */
export const NOTICE_AFTER_DAYS = 10;
/** NC G.S. 58-36-85: nonpayment terminations may be effective 15 days after the notice is mailed. */
export const NC_NONPAYMENT_NOTICE_DAYS = 15;
/** NC G.S. 58-36-85: any other termination (and nonrenewal) requires at least 60 days' notice. */
export const NC_OTHER_NOTICE_DAYS = 60;
export const RENEWAL_OFFER_DAYS = 30;
export const REINSTATEMENT_WINDOW_DAYS = 30;
export const SHORT_RATE_PENALTY = 0.1;

const round2 = (value: number) => Math.round(value * 100) / 100;
const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const date = (value: string) => parseDate(value) ?? new Date();
export const shiftDate = (value: string, days: number) => formatDate(addDays(date(value), days));
export const dayDiff = (from: string, to: string) => daysBetween(date(from), date(to));

export function balance(policy: PolicyRecord): number {
  return round2(policy.ledger.reduce((sum, entry) => sum + entry.amount, 0));
}

function ledger(policy: PolicyRecord, day: string, type: LedgerType, amount: number, detail: string): PolicyRecord {
  const entry: LedgerEntry = { id: id('led'), date: day, type, amount: round2(amount), detail };
  return { ...policy, ledger: [...policy.ledger, entry] };
}

function log(policy: PolicyRecord, day: string, event: string, detail = ''): PolicyRecord {
  return { ...policy, history: [...policy.history, { id: id('his'), date: day, event, detail }] };
}

function doc(policy: PolicyRecord, day: string, type: PolicyDocumentType, data: Record<string, string | number> = {}): PolicyRecord {
  return { ...policy, documents: [...policy.documents, { id: id('doc'), type, date: day, term: policy.termNumber, data }] };
}

/** Amount billed and not yet paid on installments that are already due. */
export function pastDue(policy: PolicyRecord, day: string): number {
  return round2(policy.installments.filter((entry) => entry.status !== 'void' && entry.status !== 'paid' && dayDiff(entry.due, day) >= 0).reduce((sum, entry) => sum + entry.amount - entry.paid, 0));
}

/** Minimum amount to bring the account current: past-due installments plus assessed fees. */
export function minimumDue(policy: PolicyRecord, day: string): number {
  return round2(Math.max(0, pastDue(policy, day) + policy.feesDue));
}

export function nextInstallment(policy: PolicyRecord): InstallmentRecord | undefined {
  return policy.installments.find((entry) => entry.status !== 'paid' && entry.status !== 'void');
}

export function buildInstallments(total: number, dueToday: number, payments: number, paymentAmount: number, effectiveDate: string, termMonths: number, downPaid: boolean): InstallmentRecord[] {
  const spacing = payments === 1 ? termMonths / 2 : 1;
  const start = date(effectiveDate);
  const list: InstallmentRecord[] = [{ id: id('ins'), number: 0, due: effectiveDate, amount: payments === 0 ? total : dueToday, paid: downPaid ? (payments === 0 ? total : dueToday) : 0, status: downPaid ? 'paid' : 'billed', billedOn: effectiveDate, lateFeeApplied: false }];
  for (let index = 1; index <= payments; index += 1) {
    list.push({ id: id('ins'), number: index, due: formatDate(addMonths(start, index * spacing)), amount: paymentAmount, paid: 0, status: 'scheduled', billedOn: '', lateFeeApplied: false });
  }
  return list;
}

/** Applies a payment to installments oldest-first; extra money is held as a credit toward the next bill. */
function applyToInstallments(policy: PolicyRecord, amount: number): PolicyRecord {
  let remaining = amount;
  const installments = policy.installments.map((entry) => {
    if (remaining <= 0 || entry.status === 'paid' || entry.status === 'void') return entry;
    const owed = round2(entry.amount - entry.paid);
    const applied = Math.min(owed, remaining);
    remaining = round2(remaining - applied);
    const paid = round2(entry.paid + applied);
    return { ...entry, paid, status: paid >= entry.amount ? 'paid' as const : entry.status };
  });
  return { ...policy, installments };
}

// ------------------------------------------------------------------ customer / agent actions

export function makePayment(policy: PolicyRecord, amount: number, method: string, day: string, auto = false): PolicyRecord {
  // Payments settle outstanding fees first, then installments oldest-first.
  const toFees = auto ? 0 : Math.min(policy.feesDue, amount);
  let next = ledger(policy, day, auto ? 'Automatic Payment' : 'Payment', -amount, `${method}${toFees > 0 ? ` ($${toFees.toFixed(2)} applied to fees)` : ''}`);
  next = { ...next, feesDue: round2(next.feesDue - toFees) };
  next = applyToInstallments(next, round2(amount - toFees));
  next = doc(next, day, 'Payment Receipt', { amount, method, confirmation: `P${Math.floor(Math.random() * 1e9)}` });
  next = log(next, day, auto ? 'Automatic payment drafted' : 'Payment received', `$${amount.toFixed(2)} by ${method}`);
  // Paying the amount due before the cancellation effective date rescinds a nonpayment cancellation.
  if (next.pendingCancel?.kind === 'nonpayment' && minimumDue(next, day) <= 0.01) {
    next = { ...next, status: 'Active', pendingCancel: null };
    next = doc(next, day, 'Rescission of Cancellation', {});
    next = log(next, day, 'Cancellation rescinded', 'Past-due amount paid before the cancellation effective date. Coverage continues with no lapse.');
  }
  if (next.renewal?.status === 'Offered' && !next.autopay && amount >= next.renewal.dueToday - 0.01 && dayDiff(day, next.expirationDate) <= RENEWAL_OFFER_DAYS) {
    next = { ...next, renewal: { ...next.renewal, status: 'Accepted' } };
    next = log(next, day, 'Renewal accepted', `Renewal down payment of $${next.renewal!.dueToday.toFixed(2)} received.`);
  }
  return next;
}

export function returnedPayment(policy: PolicyRecord, day: string): PolicyRecord | string {
  const last = [...policy.ledger].reverse().find((entry) => entry.type === 'Payment' || entry.type === 'Automatic Payment');
  if (!last) return 'There is no payment to return.';
  let next = ledger(policy, day, 'Returned Payment', -last.amount, `Payment of ${last.date} returned by the bank (NSF)`);
  next = ledger(next, day, 'Returned Payment Fee', RETURNED_PAYMENT_FEE, 'Returned payment fee');
  next = { ...next, feesDue: round2(next.feesDue + RETURNED_PAYMENT_FEE) };
  // Reverse the payment from the most recent paid installments.
  let reverse = -last.amount;
  const installments = [...next.installments].reverse().map((entry) => {
    if (reverse <= 0 || entry.paid <= 0) return entry;
    const taken = Math.min(entry.paid, reverse);
    reverse = round2(reverse - taken);
    const paid = round2(entry.paid - taken);
    // A returned payment is due immediately, even if the installment's original due date is later.
    return { ...entry, paid, due: dayDiff(entry.due, day) < 0 ? day : entry.due, status: paid < entry.amount ? 'past due' as const : entry.status };
  }).reverse();
  next = { ...next, installments };
  next = doc(next, day, 'Returned Payment Notice', { amount: -last.amount, fee: RETURNED_PAYMENT_FEE });
  next = log(next, day, 'Returned payment', `Payment of $${(-last.amount).toFixed(2)} returned; $${RETURNED_PAYMENT_FEE} fee assessed.`);
  return issueNonpaymentNotice(next, day);
}

function issueNonpaymentNotice(policy: PolicyRecord, day: string): PolicyRecord {
  if (policy.status !== 'Active') return policy;
  const effectiveDate = shiftDate(day, nonpaymentNoticeDays(policy));
  const amountDue = Math.max(minimumDue(policy, day), 0.01);
  let next: PolicyRecord = { ...policy, status: 'Pending Cancel', pendingCancel: { kind: 'nonpayment', reason: 'Nonpayment of premium', noticeDate: day, effectiveDate, amountDue, method: 'Pro Rata' } };
  next = doc(next, day, 'Notice of Cancellation', { reason: 'Nonpayment of premium', effectiveDate, amountDue, kind: 'nonpayment' });
  return log(next, day, 'Notice of cancellation mailed', `Nonpayment. Cancels ${effectiveDate} unless $${amountDue.toFixed(2)} is received first.`);
}

export interface CancelRequest {
  kind: CancelKind;
  reason: string;
  effectiveDate: string;
  method: 'Pro Rata' | 'Short Rate';
}

export function validateCancel(policy: PolicyRecord, request: CancelRequest, day: string): string {
  if (!parseDate(request.effectiveDate)) return 'Enter a valid cancellation effective date (MM/DD/YYYY).';
  if (dayDiff(policy.effectiveDate, request.effectiveDate) < 0) return 'The cancellation date cannot be before the policy effective date.';
  if (dayDiff(request.effectiveDate, policy.expirationDate) <= 0) return 'The cancellation date must be before the policy expiration date. To stop coverage at the end of the term, non-renew instead.';
  if (request.kind === 'insured' && dayDiff(request.effectiveDate, day) > 30) return 'Insured-requested cancellations cannot be backdated more than 30 days.';
  if (request.kind === 'company' && dayDiff(day, request.effectiveDate) < otherNoticeDays(policy)) return `${rulesFor(policy.state).name} requires at least ${otherNoticeDays(policy)} days' notice for a company cancellation for a reason other than nonpayment. Earliest date: ${shiftDate(day, otherNoticeDays(policy))}.`;
  if (!request.reason) return 'Select a cancellation reason.';
  return '';
}

/** Requests a cancellation: immediate when effective today or earlier, otherwise pending until the date. */
export function requestCancel(policy: PolicyRecord, request: CancelRequest, day: string): PolicyRecord {
  if (dayDiff(day, request.effectiveDate) <= 0) return cancelNow(policy, request, day);
  let next: PolicyRecord = { ...policy, status: 'Pending Cancel', pendingCancel: { kind: request.kind, reason: request.reason, noticeDate: day, effectiveDate: request.effectiveDate, amountDue: 0, method: request.method } };
  if (request.kind === 'company') next = doc(next, day, 'Notice of Cancellation', { reason: request.reason, effectiveDate: request.effectiveDate, amountDue: 0, kind: 'company' });
  return log(next, day, 'Cancellation scheduled', `${request.reason}. Effective ${request.effectiveDate} (${request.method}).`);
}

export function cancellationQuote(policy: PolicyRecord, effectiveDate: string, method: 'Pro Rata' | 'Short Rate') {
  const termDays = Math.max(1, dayDiff(policy.effectiveDate, policy.expirationDate));
  const used = Math.min(termDays, Math.max(0, dayDiff(policy.effectiveDate, effectiveDate)));
  const proRata = policy.termPremium * (used / termDays);
  const unearned = policy.termPremium - proRata;
  const penalty = method === 'Short Rate' ? unearned * SHORT_RATE_PENALTY : 0;
  const earned = round2(proRata + penalty);
  const paid = round2(-policy.ledger.filter((entry) => entry.type === 'Payment' || entry.type === 'Automatic Payment' || entry.type === 'Returned Payment').reduce((sum, entry) => sum + entry.amount, 0));
  const fees = round2(policy.ledger.filter((entry) => entry.type === 'Late Fee' || entry.type === 'Returned Payment Fee').reduce((sum, entry) => sum + entry.amount, 0));
  const net = round2(paid - earned - fees);
  return { termDays, used, earned, penalty: round2(penalty), paid, fees, refund: Math.max(0, net), balanceDue: Math.max(0, -net) };
}

function cancelNow(policy: PolicyRecord, request: CancelRequest, day: string): PolicyRecord {
  const quote = cancellationQuote(policy, request.effectiveDate, request.method);
  const credit = round2(policy.termPremium - (quote.earned - quote.penalty));
  let next = ledger(policy, day, 'Cancellation Credit', -credit, `Unearned premium ${request.effectiveDate} to ${policy.expirationDate}`);
  if (quote.penalty > 0) next = ledger(next, day, 'Short Rate Penalty', quote.penalty, `${SHORT_RATE_PENALTY * 100}% of unearned premium`);
  if (quote.refund > 0) next = ledger(next, day, 'Refund', quote.refund, 'Refund issued to original payment method (7-14 business days)');
  next = {
    ...next,
    status: 'Cancelled',
    pendingCancel: null,
    feesDue: 0,
    installments: next.installments.map((entry) => (entry.status === 'paid' ? entry : { ...entry, status: 'void' as const })),
    renewal: null,
    cancellation: { kind: request.kind, reason: request.reason, requestedOn: day, effectiveDate: request.effectiveDate, method: request.method, earned: quote.earned, paid: quote.paid, refund: quote.refund, balanceDue: quote.balanceDue, credit, feesOutstanding: policy.feesDue },
  };
  next = doc(next, day, 'Cancellation Confirmation', { reason: request.reason, effectiveDate: request.effectiveDate, method: request.method, earned: quote.earned, paid: quote.paid, refund: quote.refund, balanceDue: quote.balanceDue, kind: request.kind });
  return log(next, day, 'Policy cancelled', `${request.reason}. Effective ${request.effectiveDate}. ${quote.refund > 0 ? `Refund $${quote.refund.toFixed(2)}.` : quote.balanceDue > 0 ? `Earned premium due $${quote.balanceDue.toFixed(2)}.` : 'No refund or balance due.'} DMV notified of termination.`);
}

export function reinstatementCheck(policy: PolicyRecord, day: string): { allowed: boolean; reason: string; amount: number; lapse: boolean } {
  const cancellation = policy.cancellation;
  if (policy.status !== 'Cancelled' || !cancellation) return { allowed: false, reason: 'Only cancelled policies can be reinstated.', amount: 0, lapse: false };
  if (cancellation.kind !== 'nonpayment') return { allowed: false, reason: 'Only policies cancelled for nonpayment can be reinstated. Insured-requested or company cancellations require a new policy.', amount: 0, lapse: false };
  if (dayDiff(cancellation.effectiveDate, day) > REINSTATEMENT_WINDOW_DAYS) return { allowed: false, reason: `The ${REINSTATEMENT_WINDOW_DAYS}-day reinstatement window ended ${shiftDate(cancellation.effectiveDate, REINSTATEMENT_WINDOW_DAYS)}. Quote a new policy.`, amount: 0, lapse: false };
  // Reinstating restores the full term: the customer pays everything that would be past due today plus fees.
  const restored: PolicyRecord = { ...policy, feesDue: cancellation.feesOutstanding, ledger: policy.ledger.filter((entry) => entry.type !== 'Cancellation Credit' && entry.type !== 'Refund' && entry.type !== 'Short Rate Penalty'), installments: policy.installments.map((entry) => (entry.status === 'void' ? { ...entry, status: dayDiff(entry.due, day) >= 0 ? 'past due' as const : 'scheduled' as const } : entry)) };
  return { allowed: true, reason: '', amount: Math.max(minimumDue(restored, day), 0), lapse: dayDiff(cancellation.effectiveDate, day) > 0 };
}

export function reinstate(policy: PolicyRecord, method: string, day: string): PolicyRecord | string {
  const check = reinstatementCheck(policy, day);
  if (!check.allowed || !policy.cancellation) return check.reason;
  const cancelled = policy.cancellation;
  let next: PolicyRecord = {
    ...policy,
    ledger: policy.ledger.filter((entry) => entry.type !== 'Cancellation Credit' && entry.type !== 'Refund' && entry.type !== 'Short Rate Penalty'),
    installments: policy.installments.map((entry) => (entry.status === 'void' ? { ...entry, status: dayDiff(entry.due, day) >= 0 ? 'past due' as const : 'scheduled' as const } : entry)),
    status: 'Active',
    cancellation: null,
    feesDue: cancelled.feesOutstanding,
    lapse: check.lapse ? { from: cancelled.effectiveDate, to: shiftDate(day, -1) } : null,
  };
  next = ledger(next, day, 'Reinstatement', 0, 'Cancellation reversed');
  if (check.amount > 0) next = makePayment(next, check.amount, method, day);
  next = doc(next, day, 'Reinstatement Notice', { lapseFrom: check.lapse ? cancelled.effectiveDate : '', lapseTo: check.lapse ? shiftDate(day, -1) : '', amount: check.amount });
  if (filesFs1(next)) next = doc(next, day, 'FS-1 Certificate of Insurance', { reason: 'Reinstatement' });
  return log(next, day, 'Policy reinstated', check.lapse ? `Reinstated with a lapse in coverage from ${cancelled.effectiveDate} to ${shiftDate(day, -1)}.` : 'Reinstated with no lapse in coverage.');
}

export function changeBillPlan(policy: PolicyRecord, planId: Exclude<BillPlan, ''>, day: string): PolicyRecord | string {
  if (policy.status !== 'Active') return 'The bill plan can only be changed on an active policy.';
  const open = policy.installments.filter((entry) => entry.status === 'scheduled' || entry.status === 'billed');
  if (!open.length) return 'There are no remaining installments to change.';
  const plans = buildBillPlans(policy.fullTermPremium, policy.termMonths);
  const plan = plans.find((entry) => entry.id === planId);
  if (!plan || plan.payments === 0 || plan.payments === 1) return 'Choose a monthly installment plan (EFT, Automatic Card or Mail).';
  const feeChange = round2((plan.feePerPayment - policy.feePerPayment) * open.length);
  let next: PolicyRecord = {
    ...policy,
    billPlanId: planId,
    billPlanName: plan.name,
    autopay: planId === 'EFT' || planId === 'CARD',
    paymentMethod: planId === 'EFT' ? 'Bank account (EFT)' : planId === 'CARD' ? 'Recurring credit card' : 'Paper bill (mail)',
    feePerPayment: plan.feePerPayment,
    termPremium: round2(policy.termPremium + feeChange),
    installments: policy.installments.map((entry) => (open.includes(entry) ? { ...entry, amount: round2(entry.amount + plan.feePerPayment - policy.feePerPayment) } : entry)),
  };
  if (feeChange !== 0) next = ledger(next, day, 'Bill Plan Change', feeChange, `Installment fee change for ${open.length} remaining payment(s)`);
  next = doc(next, day, 'Bill Plan Change Confirmation', { plan: plan.name, remaining: open.length, fee: plan.feePerPayment });
  return log(next, day, 'Bill plan changed', `Now ${plan.name}. ${open.length} remaining payment(s) at the new installment fee.`);
}

export function declineRenewal(policy: PolicyRecord, day: string): PolicyRecord {
  let next: PolicyRecord = { ...policy, renewal: null, nonRenewal: { by: 'insured', noticeDate: day, reason: 'Insured does not want to renew' } };
  next = doc(next, day, 'Non-Renewal Notice', { by: 'insured', reason: 'Insured does not want to renew', expirationDate: policy.expirationDate });
  return log(next, day, 'Renewal declined by insured', `Coverage ends at expiration ${policy.expirationDate}.`);
}

export function companyNonRenew(policy: PolicyRecord, reason: string, day: string): PolicyRecord | string {
  if (dayDiff(day, policy.expirationDate) < otherNoticeDays(policy)) return `${rulesFor(policy.state).name} requires at least ${otherNoticeDays(policy)} days' notice before expiration to non-renew. The deadline for this term was ${shiftDate(policy.expirationDate, -otherNoticeDays(policy))}.`;
  if (!reason) return 'Select a non-renewal reason.';
  let next: PolicyRecord = { ...policy, renewal: null, nonRenewal: { by: 'company', noticeDate: day, reason } };
  next = doc(next, day, 'Non-Renewal Notice', { by: 'company', reason, expirationDate: policy.expirationDate });
  return log(next, day, 'Non-renewal notice mailed', `${reason}. Coverage ends ${policy.expirationDate}.`);
}

export function markSigned(policy: PolicyRecord, day: string): PolicyRecord {
  return log({ ...policy, esign: 'Signed' }, day, 'Application e-signed', 'The customer completed the e-signature.');
}

// ------------------------------------------------------------------ daily processing (training clock)

function renewalOffer(policy: PolicyRecord, day: string): PolicyRecord {
  // Deterministic renewal rating: filed base rate change, loyalty credit, and billing history.
  const late = policy.ledger.filter((entry) => entry.type === 'Late Fee' || entry.type === 'Returned Payment Fee').length;
  const reasons = [`Base rate change filed for ${rulesFor(policy.state).name}: +3.5%`, `Renewal loyalty credit (term ${policy.termNumber + 1}): -2.0%`];
  let factorValue = 1.035 * 0.98;
  if (late) { factorValue *= 1 + 0.03 * late; reasons.push(`Billing history (${late} late or returned payment${late > 1 ? 's' : ''}): +${3 * late}%`); }
  const fullTermPremium = round2(policy.fullTermPremium * factorValue);
  const plan = buildBillPlans(fullTermPremium, policy.termMonths).find((entry) => entry.id === policy.billPlanId) ?? buildBillPlans(fullTermPremium, policy.termMonths)[0];
  const effectiveDate = policy.expirationDate;
  const expirationDate = formatDate(addMonths(date(effectiveDate), policy.termMonths));
  let next: PolicyRecord = { ...policy, renewal: { offeredOn: day, effectiveDate, expirationDate, fullTermPremium, premium: plan.total, previousPremium: policy.termPremium, reasons, billPlanId: plan.id, billPlanName: plan.name, dueToday: plan.dueToday, status: policy.autopay ? 'Accepted' : 'Offered' } };
  next = doc(next, day, 'Renewal Offer', { premium: plan.total, previousPremium: policy.termPremium, effectiveDate, expirationDate, dueToday: plan.dueToday, plan: plan.name });
  return log(next, day, 'Renewal offer issued', `Renewal premium $${plan.total.toFixed(2)} (${policy.autopay ? 'renews automatically with ' + policy.billPlanName : `down payment $${plan.dueToday.toFixed(2)} due by ${policy.expirationDate}`}).`);
}

function rollRenewal(policy: PolicyRecord, day: string): PolicyRecord {
  const renewal = policy.renewal!;
  const plan = buildBillPlans(renewal.fullTermPremium, policy.termMonths).find((entry) => entry.id === renewal.billPlanId) ?? buildBillPlans(renewal.fullTermPremium, policy.termMonths)[0];
  const paidAhead = !policy.autopay;
  let next: PolicyRecord = {
    ...policy,
    termNumber: policy.termNumber + 1,
    effectiveDate: renewal.effectiveDate,
    expirationDate: renewal.expirationDate,
    termPremium: plan.total,
    fullTermPremium: renewal.fullTermPremium,
    installments: buildInstallments(plan.total, plan.dueToday, plan.payments, plan.paymentAmount, renewal.effectiveDate, policy.termMonths, paidAhead),
    renewal: null,
    lapse: null,
  };
  next = ledger(next, day, 'Renewal Premium', plan.total, `Term ${next.termNumber}: ${renewal.effectiveDate} - ${renewal.expirationDate}`);
  if (policy.autopay) next = makePayment(next, plan.dueToday, policy.paymentMethod, day, true);
  next = doc(next, day, 'Renewal Declarations', {});
  next = doc(next, day, 'ID Cards', {});
  if (filesFs1(next)) next = doc(next, day, 'FS-1 Certificate of Insurance', { reason: 'Renewal' });
  return log(next, day, 'Policy renewed', `Term ${next.termNumber} begins ${renewal.effectiveDate}. Premium $${plan.total.toFixed(2)}.`);
}

/** Runs one day of billing, cancellation and renewal events for a policy. */
export function processDay(policy: PolicyRecord, day: string): PolicyRecord {
  let next = policy;
  if (next.status === 'Cancelled' || next.status === 'Expired' || next.status === 'Non-Renewed') return next;

  // Scheduled cancellations reach their effective date.
  if (next.pendingCancel && dayDiff(next.pendingCancel.effectiveDate, day) >= 0) {
    const pending = next.pendingCancel;
    return cancelNow(next, { kind: pending.kind, reason: pending.reason, effectiveDate: pending.effectiveDate, method: pending.method }, day);
  }

  for (const entry of next.installments) {
    if (entry.status === 'paid' || entry.status === 'void') continue;
    const untilDue = dayDiff(day, entry.due);
    if (entry.status === 'scheduled' && untilDue <= BILL_LEAD_DAYS) {
      next = { ...next, installments: next.installments.map((item) => (item.id === entry.id ? { ...item, status: 'billed' as const, billedOn: day } : item)) };
      next = doc(next, day, 'Billing Statement', { due: entry.due, amount: entry.amount, autopay: next.autopay ? 'Yes' : 'No', installment: entry.number });
      next = log(next, day, 'Bill issued', `Installment ${entry.number} of $${entry.amount.toFixed(2)} due ${entry.due}${next.autopay ? ' (automatic payment)' : ''}.`);
    }
    const current = next.installments.find((item) => item.id === entry.id)!;
    if (current.status === 'paid') continue;
    if (next.autopay && untilDue <= 0 && current.status !== 'past due') {
      next = makePayment(next, round2(current.amount - current.paid), next.paymentMethod, day, true);
      continue;
    }
    if (!next.autopay && -untilDue > LATE_AFTER_DAYS && !current.lateFeeApplied) {
      next = { ...next, installments: next.installments.map((item) => (item.id === entry.id ? { ...item, status: 'past due' as const, lateFeeApplied: true } : item)) };
      next = ledger(next, day, 'Late Fee', LATE_FEE, `Installment ${entry.number} due ${entry.due} not received`);
      next = { ...next, feesDue: round2(next.feesDue + LATE_FEE) };
      next = log(next, day, 'Late fee assessed', `$${LATE_FEE.toFixed(2)} for installment ${entry.number} due ${entry.due}.`);
    }
    if (-untilDue >= NOTICE_AFTER_DAYS && next.status === 'Active' && !next.pendingCancel) next = issueNonpaymentNotice(next, day);
  }

  // Renewal offer ~30 days before expiration.
  if (next.status === 'Active' && !next.renewal && !next.nonRenewal && dayDiff(day, next.expirationDate) <= RENEWAL_OFFER_DAYS) next = renewalOffer(next, day);

  // Expiration.
  if (dayDiff(next.expirationDate, day) >= 0) {
    if (next.nonRenewal) {
      next = { ...next, status: next.nonRenewal.by === 'company' ? 'Non-Renewed' : 'Expired' };
      next = doc(next, day, 'Expiration Notice', { reason: next.nonRenewal!.reason });
      return log(next, day, 'Policy expired', `${next.nonRenewal!.reason}. DMV notified of termination.`);
    }
    if (next.renewal?.status === 'Accepted') return rollRenewal(next, day);
    next = { ...next, status: 'Expired', renewal: null };
    next = doc(next, day, 'Expiration Notice', { reason: 'Renewal premium was not received' });
    return log(next, day, 'Policy expired', 'The renewal down payment was not received by the expiration date. Coverage has lapsed.');
  }
  return next;
}

/** Advances a policy from `from` (exclusive) through `to` (inclusive). */
export function advancePolicy(policy: PolicyRecord, from: string, to: string): PolicyRecord {
  let next = policy;
  for (let day = shiftDate(from, 1); dayDiff(day, to) >= 0; day = shiftDate(day, 1)) next = processDay(next, day);
  return next;
}
