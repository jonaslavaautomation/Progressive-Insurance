// Date helpers for the carrier's MM/DD/YYYY format.
import { clockDate } from '@/utils/clock';

export function parseDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, mm, dd, yyyy] = match.map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  if (date.getFullYear() !== yyyy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
  return date;
}

export function formatDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${date.getFullYear()}`;
}

/** Today on the training clock (the real date unless a trainer advanced it). */
export function today(): Date {
  return clockDate();
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Age in whole years on `on`, or null when the DOB is not a valid date. */
export function ageOn(dob: string, on: Date = today()): number | null {
  const birth = parseDate(dob);
  if (!birth) return null;
  let age = on.getFullYear() - birth.getFullYear();
  const hadBirthday = on.getMonth() > birth.getMonth() || (on.getMonth() === birth.getMonth() && on.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

/** Rating date: the policy effective date when valid, otherwise today. */
export function ratingDate(effectiveDate: string): Date {
  return parseDate(effectiveDate) ?? today();
}
