// Credit/debit card checks for the training payment forms. Card numbers are validated in the
// browser and never stored: only the brand, last four digits and expiration date are kept.
import { parseDate } from '@/utils/dates';

export type CardBrand = 'Visa' | 'Mastercard' | 'Discover';

/** Brand from the leading digits (only the brands the carrier accepts). */
export function cardBrand(number: string): CardBrand | null {
  const digits = number.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'Visa';
  const two = Number(digits.slice(0, 2));
  const four = Number(digits.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return 'Mastercard';
  if (/^(6011|65|64[4-9])/.test(digits)) return 'Discover';
  return null;
}

/** Luhn (mod 10) check digit. */
export function luhnValid(number: string): boolean {
  const digits = number.replace(/\D/g, '');
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return digits.length > 0 && sum % 10 === 0;
}

/** "4111111111111111" -> "4111 1111 1111 1111" while typing (max 16 digits). */
export function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1228" -> "12/28" while typing. */
export function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** Problem with the card, or '' when it can be saved. `today` is MM/DD/YYYY. */
export function cardProblem(input: { name: string; number: string; expiry: string }, today: string): string {
  const digits = input.number.replace(/\D/g, '');
  if (!input.name.trim()) return 'Enter the name on the card.';
  if (!digits) return 'Enter the card number.';
  const brand = cardBrand(digits);
  if (!brand) return 'We accept Visa, Mastercard and Discover. Check the card number.';
  if (digits.length !== 16) return `${brand} card numbers are 16 digits.`;
  if (!luhnValid(digits)) return 'The card number is not valid. Check it with the card holder.';
  const match = /^(\d{2})\/(\d{2})$/.exec(input.expiry);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return 'Enter the expiration date as mm/yy.';
  const now = parseDate(today) ?? new Date();
  const expires = new Date(2000 + Number(match[2]), Number(match[1]), 0);
  if (expires < new Date(now.getFullYear(), now.getMonth(), 1)) return 'This card has expired.';
  return '';
}

export const maskCard = (last4: string) => `************${last4}`;
