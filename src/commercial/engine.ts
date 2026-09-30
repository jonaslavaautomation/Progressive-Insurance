// Commercial quote factories, rating and totals.
import type { BillPlanQuote, RatingFactor } from '@/types/quote';
import type { CommercialKey, FieldContext, ProductQuote, UnitPremium } from '@/products/types';
import type { CommercialDriver, CommercialQuote } from '@/commercial/types';
import { BUSINESS_FIELDS, COMMERCIAL_CONFIGS, YEARS_FACTOR } from '@/commercial/configs';
import { createUnit, newUnitId } from '@/products/engine';
import { round2 } from '@/products/helpers';
import { buildBillPlans, territoryFactor } from '@/utils/ratingEngine';
import { ageOn, ratingDate } from '@/utils/dates';

export const COMMERCIAL_STEPS = ['BUSINESS INFORMATION', 'PRODUCTS', 'DRIVERS', 'UNDERWRITING', 'COVERAGES/BILL PLANS', 'FINAL SALE'] as const;

export function generateCommercialQuoteNumber(): string {
  return `CA${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
}

export function createCommercialDriver(): CommercialDriver {
  return { id: `cdr-${Math.random().toString(36).slice(2, 9)}`, firstName: '', lastName: '', dob: '', licenseState: 'North Carolina', licenseNumber: '', licenseType: '', experience: '', violations: '', accidents: '' };
}

function createCommercialProduct(key: CommercialKey, zip: string): ProductQuote {
  const config = COMMERCIAL_CONFIGS[key];
  const coverages: Record<string, string> = {};
  for (const coverage of config.coverages) if (coverage.scope === 'policy') coverages[coverage.key] = coverage.default ?? '';
  return { quoteNumber: generateCommercialQuoteNumber(), units: [createUnit(config, zip)], coverages, answers: {}, interests: [], billPlan: 'PIF', ratedSignature: '', suspended: false };
}

export function createCommercialQuote(products: CommercialKey[]): CommercialQuote {
  const business: Record<string, string> = {};
  for (const field of BUSINESS_FIELDS) business[field.key] = field.default ?? '';
  return {
    products,
    business,
    drivers: products.includes('commercialAuto') ? [createCommercialDriver()] : [],
    productQuotes: Object.fromEntries(products.map((key) => [key, createCommercialProduct(key, '')])),
    answers: {},
    effectiveDate: '',
    paymentMethod: '',
    paymentAuthorized: '',
    signedApplication: false,
    confirmedAccuracy: false,
    step: 0,
    maxStep: 0,
    active: products[0],
    boundPolicyIds: [],
  };
}

export function addCommercialProducts(quote: CommercialQuote, keys: CommercialKey[]): CommercialQuote {
  const fresh = keys.filter((key) => !quote.products.includes(key));
  const productQuotes = { ...quote.productQuotes };
  for (const key of fresh) productQuotes[key] = createCommercialProduct(key, quote.business.zip ?? '');
  return { ...quote, products: [...quote.products, ...fresh], productQuotes, drivers: fresh.includes('commercialAuto') && !quote.drivers.length ? [createCommercialDriver()] : quote.drivers, active: fresh[0] ?? quote.active };
}

export function newCommercialUnitId(): string {
  return newUnitId();
}

export function commercialContext(quote: CommercialQuote, values: Record<string, string>): FieldContext {
  return { values, autoVehicles: [], mailingZip: quote.business.zip ?? '' };
}

export function commercialDriverFactor(driver: CommercialDriver, effectiveDate: string): number {
  const age = ageOn(driver.dob, ratingDate(effectiveDate));
  let value = age === null ? 1 : age < 25 ? 1.6 : age < 30 ? 1.15 : age >= 65 ? 1.1 : 1;
  value *= ({ 'Less than 3 years': 1.3, '3 to 5 years': 1.08 } as Record<string, number>)[driver.experience] ?? 1;
  value *= ({ '1': 1.2, '2': 1.45, '3 or more': 1.8 } as Record<string, number>)[driver.violations] ?? 1;
  value *= ({ '1': 1.3, '2 or more': 1.7 } as Record<string, number>)[driver.accidents] ?? 1;
  return value;
}

export interface CommercialRating {
  key: CommercialKey;
  units: UnitPremium[];
  fullTermPremium: number;
  billPlans: BillPlanQuote[];
  factors: RatingFactor[];
  discounts: string[];
  termMonths: number;
}

export function rateCommercial(key: CommercialKey, quote: CommercialQuote): CommercialRating {
  const config = COMMERCIAL_CONFIGS[key];
  const product = quote.productQuotes[key];
  const drivers = quote.drivers.map((driver) => commercialDriverFactor(driver, quote.effectiveDate));
  const lossFactor = (({ '1': 1.2, '2': 1.45, '3 or more': 1.8 } as Record<string, number>)[quote.answers.losses] ?? 1) * (quote.answers.priorCoverage === 'No' ? 1.2 : 1);
  const result = product ? config.rate({
    driverFactor: 1,
    territory: territoryFactor,
    priorFactor: 1,
    scoreFactor: 1,
    reportsApplied: true,
    multiPolicy: quote.products.length > 1,
    paperless: false,
    mvrFactor: 1,
    modelYearAge: (year) => (Number(year) ? new Date().getFullYear() - Number(year) : 99),
    commercial: {
      answers: quote.answers,
      business: quote.business,
      yearsFactor: YEARS_FACTOR[quote.business.yearsInBusiness] ?? 1,
      lossFactor,
      driverFactor: drivers.length ? drivers.reduce((sum, value) => sum + value, 0) / drivers.length : 1,
      driverCount: drivers.length,
    },
  }, product) : { units: [], policy: {}, factors: [], discounts: [] };
  const sum = round2(result.units.reduce((total, unit) => total + unit.total, 0));
  const fullTermPremium = product ? Math.max(config.minimumPremium, sum) : 0;
  const factors = product && sum < config.minimumPremium ? [...result.factors, { label: 'Minimum premium applied', value: `$${config.minimumPremium}` }] : result.factors;
  return { key, units: result.units, fullTermPremium, billPlans: buildBillPlans(fullTermPremium, config.termMonths), factors, discounts: result.discounts, termMonths: config.termMonths };
}

export function commercialSignature(key: CommercialKey, quote: CommercialQuote): string {
  const product = quote.productQuotes[key];
  return JSON.stringify([product?.units, product?.coverages, product?.answers, quote.answers, quote.business, quote.drivers, quote.products, quote.effectiveDate]);
}

export function isCommercialRated(key: CommercialKey, quote: CommercialQuote): boolean {
  const product = quote.productQuotes[key];
  return !!product && product.ratedSignature !== '' && product.ratedSignature === commercialSignature(key, quote);
}

export function recalculateCommercial(quote: CommercialQuote): CommercialQuote {
  const productQuotes = { ...quote.productQuotes };
  for (const key of quote.products) if (productQuotes[key]) productQuotes[key] = { ...productQuotes[key]!, ratedSignature: commercialSignature(key, quote) };
  return { ...quote, productQuotes };
}

export function commercialTotals(quote: CommercialQuote) {
  return quote.products.map((key) => {
    const rating = rateCommercial(key, quote);
    const product = quote.productQuotes[key];
    const plan = rating.billPlans.find((entry) => entry.id === product?.billPlan) ?? rating.billPlans[0];
    return { key, quoteNumber: product?.quoteNumber ?? '', rated: isCommercialRated(key, quote), plan, termMonths: rating.termMonths, rating };
  });
}
