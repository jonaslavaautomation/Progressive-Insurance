// Input masks applied as the VA types, mirroring the carrier portal's formatting.

export type Mask = 'date' | 'phone' | 'ssn' | 'zip' | 'digits' | 'number' | 'money' | 'vin' | 'hin';

function digits(value: string, max: number) {
  return value.replace(/\D/g, '').slice(0, max);
}

function group(value: string, sizes: number[], separator: string) {
  const parts: string[] = [];
  let index = 0;
  for (const size of sizes) {
    if (index >= value.length) break;
    parts.push(value.slice(index, index + size));
    index += size;
  }
  return parts.join(separator);
}

export function applyMask(mask: Mask | undefined, value: string): string {
  switch (mask) {
    case 'date': return group(digits(value, 8), [2, 2, 4], '/');
    case 'phone': return group(digits(value, 10), [3, 3, 4], '-');
    case 'ssn': return group(digits(value, 9), [3, 2, 4], '-');
    case 'zip': return digits(value, 5);
    case 'digits': return digits(value, 3);
    case 'number': return digits(value, 5);
    case 'hin': return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    case 'money': {
      const whole = digits(value, 7);
      return whole ? Number(whole).toLocaleString('en-US') : '';
    }
    case 'vin': return value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
    default: return value;
  }
}

export function moneyToNumber(value: string): number {
  return Number(value.replace(/[^\d.]/g, '')) || 0;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
