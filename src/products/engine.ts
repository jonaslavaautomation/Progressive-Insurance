// Creates, rates and summarizes the non-Auto product quotes.
import type { BillPlanQuote, QuoteData, RatingFactor } from '@/types/quote';
import type { FieldContext, OtherProductKey, ProductConfig, ProductQuote, ProductUnit, UnitPremium } from '@/products/types';
import { PRODUCT_CONFIGS } from '@/products/configs';
import { round2 } from '@/products/helpers';
import { SCORE_TIER_FACTORS, activeProducts, buildBillPlans, primaryDriverFactor, priorInsuranceFactor, rateQuote, reportsApplied, selectedPlan, territoryFactor, vehicleLabel } from '@/utils/ratingEngine';

export function newUnitId(): string {
  return `unit-${Math.random().toString(36).slice(2, 10)}`;
}

export function createUnit(config: ProductConfig, mailingZip: string): ProductUnit {
  const values: Record<string, string> = {};
  for (const field of config.unitFields) values[field.key] = field.key === 'garagingZip' ? mailingZip : field.default ?? '';
  const coverages: Record<string, string> = {};
  for (const coverage of config.coverages) if (coverage.scope === 'unit') coverages[coverage.key] = coverage.default ?? '';
  return { id: newUnitId(), values, coverages };
}

export function createProductQuote(key: OtherProductKey, quoteNumber: string, mailingZip: string): ProductQuote {
  const config = PRODUCT_CONFIGS[key];
  const coverages: Record<string, string> = {};
  for (const coverage of config.coverages) if (coverage.scope === 'policy') coverages[coverage.key] = coverage.default ?? '';
  return { quoteNumber, units: [createUnit(config, mailingZip)], coverages, answers: {}, interests: [], billPlan: 'PIF', ratedSignature: '', suspended: false };
}

export function fieldContext(quote: QuoteData, values: Record<string, string>): FieldContext {
  return { values, autoVehicles: quote.vehicles.map((vehicle, index) => ({ id: vehicle.id, label: vehicleLabel(vehicle, index) })), mailingZip: quote.insured.address.zip };
}

export interface ProductRating {
  key: OtherProductKey;
  units: UnitPremium[];
  fullTermPremium: number;
  billPlans: BillPlanQuote[];
  factors: RatingFactor[];
  discounts: string[];
  termMonths: number;
}

export function rateProduct(key: OtherProductKey, quote: QuoteData): ProductRating {
  const config = PRODUCT_CONFIGS[key];
  const product = quote.productQuotes[key];
  const applied = reportsApplied(quote);
  const { reports, additional } = quote;
  const mvrFactor = applied && config.usesMvr ? 1 + 0.15 * reports.mvrFindings.length : 1;
  const effectiveYear = Number(quote.policy.effectiveDate.slice(-4)) || new Date().getFullYear();
  const result = product ? config.rate({
    driverFactor: config.motorized || config.usesMvr ? primaryDriverFactor(quote) : 1,
    territory: territoryFactor,
    priorFactor: applied ? priorInsuranceFactor(quote).factor : 1,
    scoreFactor: applied ? SCORE_TIER_FACTORS[reports.scoreTier] ?? 1 : 1,
    reportsApplied: applied,
    multiPolicy: additional.crossSell.length > 0 || activeProducts(quote).length > 1,
    paperless: additional.paperless === 'Yes',
    mvrFactor,
    modelYearAge: (year) => (Number(year) ? effectiveYear - Number(year) : 99),
  }, product) : { units: [], policy: {}, factors: [], discounts: [] };
  const sum = round2(result.units.reduce((total, unit) => total + unit.total, 0) + Object.values(result.policy).reduce((total, amount) => total + amount, 0));
  const fullTermPremium = product ? Math.max(config.minimumPremium, sum) : 0;
  const factors = sum < config.minimumPremium ? [...result.factors, { label: 'Minimum premium applied', value: `$${config.minimumPremium}` }] : result.factors;
  return { key, units: result.units, fullTermPremium, billPlans: buildBillPlans(fullTermPremium, config.termMonths), factors, discounts: result.discounts, termMonths: config.termMonths };
}

/** Everything that affects a product's price; a change requires RECALCULATE. */
export function productSignature(key: OtherProductKey, quote: QuoteData): string {
  const product = quote.productQuotes[key];
  const drivers = quote.drivers.map((driver) => [driver.dob, driver.driverStatus, driver.incidents.map((incident) => incident.code)]);
  const { reports, additional } = quote;
  return JSON.stringify([product?.units, product?.coverages, product?.answers, drivers, reports.priorSource, reports.scoreTier, reports.mvrFindings, additional.paperless, additional.crossSell, activeProducts(quote), quote.policy.effectiveDate]);
}

export function isProductRated(key: OtherProductKey, quote: QuoteData): boolean {
  const product = quote.productQuotes[key];
  return !!product && product.ratedSignature !== '' && product.ratedSignature === productSignature(key, quote);
}

export interface ProductTotal {
  key: 'auto' | OtherProductKey;
  quoteNumber: string;
  rated: boolean;
  plan: BillPlanQuote;
  termMonths: number;
}

/** Selected-plan totals for every active product, used by Portfolio, Final Sale and the documents. */
export function productTotals(quote: QuoteData, autoRated: boolean): ProductTotal[] {
  return activeProducts(quote).map((key) => {
    if (key === 'auto') return { key, quoteNumber: quote.policy.quoteNumber, rated: autoRated, plan: selectedPlan(rateQuote(quote), quote.pointOfSale.billPlan), termMonths: 6 };
    const product = quote.productQuotes[key];
    const rating = rateProduct(key, quote);
    const plan = rating.billPlans.find((entry) => entry.id === product?.billPlan) ?? rating.billPlans[0];
    return { key, quoteNumber: product?.quoteNumber ?? '', rated: isProductRated(key, quote), plan, termMonths: rating.termMonths };
  });
}
