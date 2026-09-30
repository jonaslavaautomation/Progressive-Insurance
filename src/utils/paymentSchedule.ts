import type { BillPlanQuote } from '@/types/quote';
import { addMonths, formatDate, ratingDate } from '@/utils/dates';

export interface Installment {
  due: string;
  description: string;
  amount: number;
}

/** Due dates for a 6-month bill plan: the down payment at the effective date, then monthly. */
export function paymentSchedule(plan: BillPlanQuote, effectiveDate: string): Installment[] {
  const start = ratingDate(effectiveDate);
  if (plan.payments === 0) return [{ due: formatDate(start), description: `${plan.name} (6-month term)`, amount: plan.total }];
  // Five monthly payments, or a single second installment at mid-term.
  const spacing = plan.payments === 1 ? 3 : 1;
  return [
    { due: formatDate(start), description: 'Down payment (due today)', amount: plan.dueToday },
    ...Array.from({ length: plan.payments }, (_, index) => ({
      due: formatDate(addMonths(start, (index + 1) * spacing)),
      description: `Payment ${index + 1} of ${plan.payments}${plan.feePerPayment ? ` (includes $${plan.feePerPayment.toFixed(2)} fee)` : ''}`,
      amount: plan.paymentAmount,
    })),
  ];
}

export function planPaymentText(plan: BillPlanQuote): { line: string; sub: string } {
  const money = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (plan.payments === 0) return { line: `${money(plan.dueToday)} due today`, sub: '100% total payment' };
  return {
    line: `${money(plan.dueToday)} due today + ${plan.payments} payment${plan.payments > 1 ? 's' : ''} of ${money(plan.paymentAmount)} = ${money(plan.total)}`,
    sub: `${(plan.percentDown * 100).toFixed(2)}% total payment, ${money(plan.feePerPayment)} fee per future payment included`,
  };
}
