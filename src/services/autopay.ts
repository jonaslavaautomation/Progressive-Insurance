// Automatic payments: the account payments draft from, updating the card or bank account on file,
// enrolling and unenrolling. Only the last four digits of a card or account are ever stored.
import type { PaymentAccount, PolicyRecord } from '@/types/policy';
import { changeBillPlan, nextInstallment } from '@/services/policyEngine';
import { cardBrand } from '@/utils/cards';
import { clockDate } from '@/utils/clock';

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
    // A card still valid on the training clock: issue month, two years out.
    const month = policy.issuedOn.slice(0, 2) || '01';
    return { kind: 'card', brand: 'Visa', last4: seededLast4(policy, 'card'), expiry: `${month}/${String((clockDate().getFullYear() + 2) % 100).padStart(2, '0')}`, updatedOn: policy.issuedOn };
  }
  return null;
}

/** "Automatic Card", "Automatic EFT", "Pay by Mail", "Paid in Full". */
export function paymentMethodName(policy: PolicyRecord): string {
  if (policy.billPlanId === 'PIF') return 'Paid in Full';
  if (policy.autopay) return paymentAccountOf(policy)?.kind === 'card' ? 'Automatic Card' : 'Automatic EFT';
  return 'Pay by Mail';
}

/** Which automatic-payment workflow Billing and Payments offers: it follows the payment method. */
export type AutopayMode = 'card' | 'bank' | 'enroll';
export function autopayMode(policy: PolicyRecord): AutopayMode | null {
  if (policy.status !== 'Active' && policy.status !== 'Pending Cancel') return null;
  // Paid in full with an account saved for the renewal: update that account.
  if (policy.billPlanId === 'PIF' && policy.paymentAccount) return policy.paymentAccount.kind;
  // Enrolling changes the bill plan, which the carrier allows on active policies only.
  if (!policy.autopay) return policy.status === 'Active' ? 'enroll' : null;
  return paymentAccountOf(policy)?.kind === 'card' ? 'card' : 'bank';
}
export const AUTOPAY_LABELS: Record<AutopayMode, string> = { card: 'Update Credit Card', bank: 'Update Bank Account', enroll: 'Enroll in Automatic Payments' };

export interface Verification { agentName: string; requester: string; email: string; agentEmail: string }
export interface CardUpdate extends Verification { name: string; number: string; expiry: string }
export interface BankUpdate extends Verification { type: string; name: string; routing: string; account: string }

/** Moves an installment policy onto the matching automatic plan; paid-in-full policies keep their plan. */
function onPlan(policy: PolicyRecord, planId: 'CARD' | 'EFT', day: string): PolicyRecord | string {
  if (policy.billPlanId === planId || policy.billPlanId === 'PIF' || !nextInstallment(policy)) return policy;
  return changeBillPlan(policy, planId, day);
}

function finish(policy: PolicyRecord, account: PaymentAccount, input: Verification, what: string, day: string): PolicyRecord {
  const emailChanged = input.email.trim() !== policy.insured.email;
  const detail = [
    `${what} now used for ${policy.billPlanId === 'PIF' ? 'renewal' : 'automatic'} payments.`,
    `Requested by ${input.requester}; processed by ${input.agentName.trim()}.`,
    emailChanged ? `Policyholder email ${input.email.trim() ? `changed to ${input.email.trim()}` : 'removed'}.` : '',
    input.agentEmail.trim() ? `Confirmation copy sent to ${input.agentEmail.trim()}.` : '',
  ].filter(Boolean).join(' ');
  return {
    ...policy,
    paymentAccount: account,
    autopay: policy.billPlanId === 'PIF' ? policy.autopay : true,
    insured: emailChanged ? { ...policy.insured, email: input.email.trim() } : policy.insured,
    history: [...policy.history, { id: hid(), date: day, event: 'Automatic payment method updated', detail }],
  };
}

function inForce(policy: PolicyRecord): string {
  return policy.status === 'Active' || policy.status === 'Pending Cancel' ? '' : 'Automatic payments can only be updated on an in-force policy.';
}

/** Saves a card for automatic payments (moves mail/EFT installments to the Automatic Card plan). */
export function updateAutopayCard(policy: PolicyRecord, input: CardUpdate, day: string): PolicyRecord | string {
  const blocked = inForce(policy);
  if (blocked) return blocked;
  const digits = input.number.replace(/\D/g, '');
  const brand = cardBrand(digits);
  if (!brand) return 'We accept Visa, Mastercard and Discover.';
  const moved = onPlan(policy, 'CARD', day);
  if (typeof moved === 'string') return moved;
  const next = { ...moved, paymentMethod: moved.billPlanId === 'PIF' ? moved.paymentMethod : 'Recurring credit card' };
  return finish(next, { kind: 'card', brand, last4: digits.slice(-4), expiry: input.expiry, name: input.name.trim(), updatedOn: day }, input, `${brand} ending in ${digits.slice(-4)} (exp ${input.expiry})`, day);
}

/** Saves a bank account for automatic payments (moves mail/card installments to the EFT plan). */
export function updateAutopayBank(policy: PolicyRecord, input: BankUpdate, day: string): PolicyRecord | string {
  const blocked = inForce(policy);
  if (blocked) return blocked;
  const last4 = input.account.replace(/\D/g, '').slice(-4);
  const moved = onPlan(policy, 'EFT', day);
  if (typeof moved === 'string') return moved;
  const next = { ...moved, paymentMethod: moved.billPlanId === 'PIF' ? moved.paymentMethod : 'Bank account (EFT)' };
  return finish(next, { kind: 'bank', brand: input.type, last4, name: input.name.trim(), updatedOn: day }, input, `${input.type} account ending in ${last4}`, day);
}

/** Moves an automatic-payment policy to Pay by Mail. */
export function unenrollAutopay(policy: PolicyRecord, day: string): PolicyRecord | string {
  if (!policy.autopay) return 'This policy is not on automatic payments.';
  const moved = changeBillPlan(policy, 'MAIL', day);
  if (typeof moved === 'string') return moved;
  return { ...moved, paymentAccount: undefined, history: [...moved.history, { id: hid(), date: day, event: 'Unenrolled from automatic payments', detail: 'Remaining installments will be billed by mail.' }] };
}
