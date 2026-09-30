import type { BillPlan, RatingResult } from '@/types/quote';
import { POLICY_TERM_MONTHS } from '@/utils/ratingEngine';
import { addMonths, formatDate, ratingDate } from '@/utils/dates';

export interface Installment {
  due: string;
  description: string;
  amount: number;
}

export function paymentSchedule(rating: RatingResult, billPlan: BillPlan, effectiveDate: string): Installment[] {
  const start = ratingDate(effectiveDate);
  if (billPlan === 'Paid in Full') {
    return [{ due: formatDate(start), description: `Paid in full (${POLICY_TERM_MONTHS}-month term)`, amount: rating.paidInFullPremium }];
  }
  return Array.from({ length: POLICY_TERM_MONTHS }, (_, month) => ({
    due: formatDate(addMonths(start, month)),
    description: month === 0 ? 'Down payment (due at binding)' : `Installment ${month + 1} of ${POLICY_TERM_MONTHS}`,
    amount: rating.monthlyPremium,
  }));
}

export function dueToday(rating: RatingResult, billPlan: BillPlan): number {
  return billPlan === 'Paid in Full' ? rating.paidInFullPremium : rating.monthlyPremium;
}
