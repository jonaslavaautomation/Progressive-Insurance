// Automatic payments: the account payments draft from, updating the card on file, and unenrolling.
import type { PaymentAccount, PolicyRecord } from '@/types/policy';
import { changeBillPlan, nextInstallment } from '@/services/policyEngine';
import { cardBrand } from '@/utils/cards';

const hid = () => `his-${Math.random().toString(36).slice(2, 10)}`;

/** Four stable digits per policy for accounts issued before an account was recorded. */
function seededLast4(policy: PolicyRecord, salt: string): string {
  let hash = 7;
  for (const char of `${policy.policyNumber}${salt}`) hash = (hash * 31 + char.charCodeAt(0)) % 10000;
  return String(hash).padStart(4, '0');
}

/** The account automatic payments use, if the policy has one. */
export function paymentAccountOf(policy: PolicyRecord): PaymentAccount | null {
  if (policy.paymentAccount) return policy.paymentAccount;
  if (/EFT|bank/i.test(policy.paymentMethod) || policy.billPlanId.startsWith('EFT')) return { kind: 'bank', brand: 'Checking', last4: seededLast4(policy, 'bank'), updatedOn: policy.issuedOn };
  if (/card/i.test(policy.paymentMethod)) {
    const issued = policy.issuedOn.split('/');
    return { kind: 'card', brand: 'Visa', last4: seededLast4(policy, 'card'), expiry: `${issued[0] ?? '01'}/${String(Number((issued[2] ?? '2026').slice(2)) + 4).padStart(2, '0')}`, updatedOn: policy.issuedOn };
  }
  return null;
}

/** "Automatic Card", "Automatic EFT", "Pay by Mail", "Paid in Full". */
export function paymentMethodName(policy: PolicyRecord): string {
  if (policy.billPlanId === 'PIF') return 'Paid in Full';
  if (policy.autopay) return paymentAccountOf(policy)?.kind === 'card' ? 'Automatic Card' : 'Automatic EFT';
  return 'Pay by Mail';
}

export interface CardUpdate {
  name: string;
  number: string;
  expiry: string;
  agentName: string;
  requester: string;
  email: string;
  agentEmail: string;
}

/**
 * Saves a new card for automatic payments. A policy billed by mail or EFT moves to the Automatic
 * Card bill plan. Only the brand and last four digits are kept.
 */
export function updateAutopayCard(policy: PolicyRecord, input: CardUpdate, day: string): PolicyRecord | string {
  if (policy.status !== 'Active' && policy.status !== 'Pending Cancel') return 'Automatic payments can only be updated on an in-force policy.';
  const digits = input.number.replace(/\D/g, '');
  const brand = cardBrand(digits);
  if (!brand) return 'We accept Visa, Mastercard and Discover.';
  let next = policy;
  const remaining = nextInstallment(policy);
  if (policy.billPlanId !== 'CARD' && policy.billPlanId !== 'PIF' && remaining) {
    const moved = changeBillPlan(policy, 'CARD', day);
    if (typeof moved === 'string') return moved;
    next = moved;
  }
  const last4 = digits.slice(-4);
  const emailChanged = input.email.trim() !== policy.insured.email;
  next = {
    ...next,
    paymentAccount: { kind: 'card', brand, last4, expiry: input.expiry, name: input.name.trim(), updatedOn: day },
    paymentMethod: next.billPlanId === 'PIF' ? next.paymentMethod : 'Recurring credit card',
    insured: emailChanged ? { ...next.insured, email: input.email.trim() } : next.insured,
  };
  const detail = [
    `${brand} ending in ${last4} (exp ${input.expiry}) now used for ${next.billPlanId === 'PIF' ? 'renewal' : 'automatic'} payments.`,
    `Requested by ${input.requester}; processed by ${input.agentName.trim()}.`,
    emailChanged ? `Policyholder email ${input.email.trim() ? `changed to ${input.email.trim()}` : 'removed'}.` : '',
    input.agentEmail.trim() ? `Confirmation copy sent to ${input.agentEmail.trim()}.` : '',
  ].filter(Boolean).join(' ');
  return { ...next, history: [...next.history, { id: hid(), date: day, event: 'Automatic payment method updated', detail }] };
}

/** Moves an automatic-payment policy to Pay by Mail. */
export function unenrollAutopay(policy: PolicyRecord, day: string): PolicyRecord | string {
  if (!policy.autopay) return 'This policy is not on automatic payments.';
  const moved = changeBillPlan(policy, 'MAIL', day);
  if (typeof moved === 'string') return moved;
  return { ...moved, paymentAccount: undefined, history: [...moved.history, { id: hid(), date: day, event: 'Unenrolled from automatic payments', detail: 'Remaining installments will be billed by mail.' }] };
}
