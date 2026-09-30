import type { Choice, FieldContext, FieldDef } from '@/products/types';
import { MODEL_YEARS } from '@/data/vehicleCatalog';
import { moneyToNumber } from '@/utils/masks';

export const round2 = (value: number) => Math.round(value * 100) / 100;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Builds choices from [value, label?, base?] tuples. */
export function choices(list: (string | [string, string?, number?])[]): Choice[] {
  return list.map((entry) => (typeof entry === 'string' ? { value: entry, label: entry } : { value: entry[0], label: entry[1] ?? entry[0], base: entry[2] }));
}

export const YES_NO_CHOICES = choices(['Yes', 'No']);
export const YEAR_CHOICES = choices(MODEL_YEARS);

export function resolveOptions(field: FieldDef, ctx: FieldContext): Choice[] {
  return typeof field.options === 'function' ? field.options(ctx) : field.options ?? [];
}

export function baseOf(field: FieldDef | undefined, value: string, ctx?: FieldContext): number {
  if (!field) return 0;
  const options = typeof field.options === 'function' ? (ctx ? field.options(ctx) : []) : field.options ?? [];
  return options.find((option) => option.value === value)?.base ?? 0;
}

export function money(value: string): number {
  return moneyToNumber(value);
}

/** Lookup table factor, e.g. factor({ Sport: 1.75 }, value, 1). */
export function factor(table: Record<string, number>, value: string, fallback = 1): number {
  return table[value] ?? fallback;
}

/** Band a number: bands are [upperExclusive, factor] pairs; the last factor applies above them. */
export function band(value: number, bands: [number, number][], above: number): number {
  for (const [limit, result] of bands) if (value < limit) return result;
  return above;
}

export const pct = (value: number) => `${value >= 1 ? '+' : '−'}${Math.abs(Math.round((value - 1) * 100))}%`;
