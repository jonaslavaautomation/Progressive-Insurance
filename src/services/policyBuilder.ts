// Turns a bound quote into issued PolicyRecords (one per product), and rebuilds a policy's
// coverage snapshot from its rating source after a policy change.
import type { CoverageLine, InsuredSnapshot, PolicyDocument, PolicyRecord, PolicySource, UnitSnapshot } from '@/types/policy';
import type { BillPlanQuote, QuoteData, RatingResult } from '@/types/quote';
import type { AnyProductKey, FieldContext, OtherProductKey, ProductConfig, ProductKey, ProductQuote, UnitPremium } from '@/products/types';
import type { CommercialQuote } from '@/commercial/types';
import { BI_PD, COLL_DEDUCTIBLES, ETE, MED_PAY, OTC_DEDUCTIBLES, TOWING, UMPD, UM_BI, optionLabel } from '@/data/options';
import { PRODUCT_CONFIGS, productLabel } from '@/products/configs';
import { COMMERCIAL_CONFIGS } from '@/commercial/configs';
import { fieldContext, productTotals, rateProduct } from '@/products/engine';
import { commercialContext, commercialTotals, rateCommercial } from '@/commercial/engine';
import { resolveOptions } from '@/products/helpers';
import { driverName, rateQuote, ratedDrivers, vehicleName } from '@/utils/ratingEngine';
import { addMonths, formatDate, parseDate } from '@/utils/dates';
import { buildInstallments } from '@/services/policyEngine';

const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const EXTRA_NAMES: Record<string, string> = { hull: 'Physical Damage (Hull)', trailer: 'Boat Trailer', fullTimer: "Full-Timer's Coverage", filing: 'State/Federal Filing', property: 'Property (Building & Contents)' };

export function generatePolicyNumber(): string {
  return `9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

export function autoUnits(quote: QuoteData, rating: RatingResult): { units: UnitSnapshot[]; policy: CoverageLine[] } {
  const { coverages } = quote;
  const units = quote.vehicles.map((vehicle) => {
    const premium = rating.vehicles.find((entry) => entry.vehicleId === vehicle.id);
    const amount = (key: keyof NonNullable<typeof premium>['coverages']) => premium?.coverages[key] ?? 0;
    return {
      label: vehicleName(vehicle),
      details: [vehicle.bodyStyle, `Garaged ${vehicle.garagingZip}`, vehicle.primaryUse, vehicle.annualMiles ? `${vehicle.annualMiles} mi/yr` : ''].filter(Boolean),
      idNumber: vehicle.vin,
      premium: premium?.total ?? 0,
      coverages: [
        { label: 'Bodily Injury & Property Damage', value: optionLabel(BI_PD, coverages.bodilyInjuryPd), premium: amount('bipd') },
        { label: 'Medical Payment', value: optionLabel(MED_PAY, coverages.medicalPayments), premium: amount('medpay') },
        { label: 'Other Than Collision', value: optionLabel(OTC_DEDUCTIBLES, vehicle.compDeductible), premium: amount('otc') },
        { label: 'Collision', value: optionLabel(COLL_DEDUCTIBLES, vehicle.collDeductible), premium: amount('coll') },
        { label: 'Extended Transportation Expense', value: optionLabel(ETE, vehicle.rental), premium: amount('ete') },
        { label: 'Towing and Labor', value: optionLabel(TOWING, vehicle.roadside), premium: amount('towing') },
        { label: 'Customizing Equipment', value: `$${Number(vehicle.customEquipment.replace(/\D/g, '') || 0).toLocaleString('en-US')}`, premium: amount('cec') },
      ],
    };
  });
  return {
    units,
    policy: [
      { label: 'Uninsured/Underinsured Motorist BI', value: optionLabel(UM_BI, coverages.uninsuredMotorist), premium: rating.umbi },
      { label: 'Uninsured Motorist Property Damage', value: optionLabel(UMPD, coverages.umpd), premium: rating.umpd },
      { label: 'Snapshot', value: coverages.snapshot || 'Do Not Participate' },
    ],
  };
}

/** Coverage snapshot for any config-driven product (personal toys/renters or commercial). */
export function configUnits(config: ProductConfig, product: ProductQuote, ratingUnits: UnitPremium[], ctxFor: (values: Record<string, string>) => FieldContext): { units: UnitSnapshot[]; policy: CoverageLine[] } {
  const labelFor = (defKey: string, value: string, values: Record<string, string>) => {
    const def = [...config.unitFields, ...config.coverages].find((entry) => entry.key === defKey);
    if (!def) return value;
    if (def.type === 'display') return def.compute?.(ctxFor(values)) ?? '';
    if (def.type === 'money') return value ? `$${Number(value.replace(/\D/g, '')).toLocaleString('en-US')}` : '—';
    return resolveOptions(def, ctxFor(values)).find((option) => option.value === value)?.label ?? (value || '—');
  };
  const units = product.units.map((unit) => {
    const premium = ratingUnits.find((entry) => entry.unitId === unit.id);
    const details = config.unitFields.filter((field) => field.key !== config.idField && unit.values[field.key] && !['make', 'model', 'year'].includes(field.key)).slice(0, 5).map((field) => `${field.label.replace(/[:*?]/g, '').trim()}: ${labelFor(field.key, unit.values[field.key], unit.values)}`);
    const coverages = config.coverages.filter((coverage) => coverage.scope === 'unit').map((coverage) => ({ label: coverage.label.replace(/[:*]/g, '').trim(), value: labelFor(coverage.key, unit.coverages[coverage.key] ?? '', unit.coverages), premium: premium?.amounts[coverage.key] ?? 0 }));
    const extras = Object.entries(premium?.amounts ?? {}).filter(([amountKey, amount]) => amount > 0 && !config.coverages.some((coverage) => coverage.key === amountKey)).map(([amountKey, amount]) => ({ label: EXTRA_NAMES[amountKey] ?? amountKey, value: 'Included', premium: amount }));
    return { label: config.describe(unit), details, idNumber: config.idField ? unit.values[config.idField] ?? '' : '', premium: premium?.total ?? 0, coverages: [...coverages, ...extras] };
  });
  const policy = config.coverages.filter((coverage) => coverage.scope === 'policy').map((coverage) => ({
    label: coverage.label.replace(/[:*]/g, '').trim(),
    value: labelFor(coverage.key, product.coverages[coverage.key] ?? '', product.coverages),
    premium: ratingUnits.reduce((sum, unit) => sum + (unit.amounts[coverage.key] ?? 0), 0),
  }));
  return { units, policy };
}

export function productUnits(quote: QuoteData, key: OtherProductKey): { units: UnitSnapshot[]; policy: CoverageLine[] } {
  const product = quote.productQuotes[key];
  if (!product) return { units: [], policy: [] };
  return configUnits(PRODUCT_CONFIGS[key], product, rateProduct(key, quote).units, (values) => fieldContext(quote, values));
}

export interface SourceRating { units: UnitSnapshot[]; policyCoverages: CoverageLine[]; discounts: string[]; fullTermPremium: number; plans: BillPlanQuote[]; termMonths: number }

/** Rates a policy's source for one product and rebuilds its coverage snapshot. */
export function rateSource(source: PolicySource, product: AnyProductKey): SourceRating {
  if (source.kind === 'commercial') {
    const key = product as keyof typeof COMMERCIAL_CONFIGS;
    const rating = rateCommercial(key, source.quote);
    const quote = source.quote.productQuotes[key];
    const snapshot = quote ? configUnits(COMMERCIAL_CONFIGS[key], quote, rating.units, (values) => commercialContext(source.quote, values)) : { units: [], policy: [] };
    return { units: snapshot.units, policyCoverages: snapshot.policy, discounts: rating.discounts, fullTermPremium: rating.fullTermPremium, plans: rating.billPlans, termMonths: rating.termMonths };
  }
  if (product === 'auto') {
    const rating = rateQuote(source.quote);
    const snapshot = autoUnits(source.quote, rating);
    return { units: snapshot.units, policyCoverages: snapshot.policy, discounts: rating.appliedDiscounts, fullTermPremium: rating.fullTermPremium, plans: rating.billPlans, termMonths: 6 };
  }
  const key = product as OtherProductKey;
  const rating = rateProduct(key, source.quote);
  const snapshot = productUnits(source.quote, key);
  return { units: snapshot.units, policyCoverages: snapshot.policy, discounts: rating.discounts, fullTermPremium: rating.fullTermPremium, plans: rating.billPlans, termMonths: rating.termMonths };
}

function newPolicy(input: { key: AnyProductKey; quoteNumber: string; policyNumber: string; plan: BillPlanQuote; termMonths: number; effectiveDate: string; insured: InsuredSnapshot; drivers: string[]; agentCode: string; agentName: string; day: string; paymentMethod: string; delivery: string; source: PolicySource; rating: SourceRating }): PolicyRecord {
  const { key, plan, termMonths, effectiveDate, day, rating } = input;
  const autopay = plan.id === 'EFT' || plan.id === 'CARD';
  const paymentMethod = plan.id === 'EFT' ? 'Bank account (EFT)' : plan.id === 'CARD' ? 'Recurring credit card' : input.paymentMethod || 'Bank account (EFT)';
  const documents: PolicyDocument[] = [
    { id: id('doc'), type: 'Declarations', date: day, term: 1, data: {} },
    { id: id('doc'), type: 'Application', date: day, term: 1, data: { delivery: input.delivery } },
    { id: id('doc'), type: 'Payment Receipt', date: day, term: 1, data: { amount: plan.dueToday, method: input.paymentMethod || paymentMethod, confirmation: `P${Math.floor(Math.random() * 1e9)}` } },
  ];
  if (!['renters', 'boat', 'bop', 'mgmt'].includes(key)) documents.splice(1, 0, { id: id('doc'), type: 'ID Cards', date: day, term: 1, data: {} });
  if (key === 'auto') documents.push({ id: id('doc'), type: 'FS-1 Certificate of Insurance', date: day, term: 1, data: { reason: 'New business' } });
  if (key === 'bop' || key === 'commercialAuto' || key === 'mgmt') documents.push({ id: id('doc'), type: 'Certificate of Insurance', date: day, term: 1, data: { holder: 'Evidence of coverage' } });
  return {
    id: id('pol'),
    policyNumber: input.policyNumber,
    quoteNumber: input.quoteNumber,
    product: key,
    productName: productLabel(key),
    status: 'Active',
    insured: input.insured,
    drivers: input.drivers,
    agentCode: input.agentCode,
    agentName: input.agentName,
    state: 'North Carolina',
    termMonths,
    termNumber: 1,
    effectiveDate,
    expirationDate: formatDate(addMonths(parseDate(effectiveDate) ?? new Date(), termMonths)),
    issuedOn: day,
    termPremium: plan.total,
    fullTermPremium: rating.fullTermPremium,
    billPlanId: plan.id,
    billPlanName: plan.name,
    feePerPayment: plan.feePerPayment,
    autopay,
    paymentMethod,
    units: rating.units,
    policyCoverages: rating.policyCoverages,
    discounts: rating.discounts,
    installments: buildInstallments(plan.total, plan.dueToday, plan.payments, plan.paymentAmount, effectiveDate, termMonths, true),
    ledger: [
      { id: id('led'), date: day, type: 'Premium', amount: plan.total, detail: `New business, term 1 (${plan.name})` },
      { id: id('led'), date: day, type: 'Payment', amount: -plan.dueToday, detail: `Down payment - ${input.paymentMethod || paymentMethod}` },
    ],
    documents,
    history: [
      { id: id('his'), date: day, event: 'Policy issued', detail: `${productLabel(key)} policy bound from Quote #${input.quoteNumber}. Effective ${effectiveDate}.` },
      { id: id('his'), date: day, event: 'Down payment received', detail: `$${plan.dueToday.toFixed(2)} (${plan.name})` },
    ],
    esign: input.delivery === 'In person (print and sign)' ? 'Signed' : 'Pending',
    pendingCancel: null,
    feesDue: 0,
    cancellation: null,
    renewal: null,
    nonRenewal: null,
    lapse: null,
    source: input.source,
    lienholders: [],
  };
}

/** A personal policy keeps only its own product in the rating source. */
function personalSource(quote: QuoteData, key: ProductKey): PolicySource {
  const data: QuoteData = {
    policy: quote.policy, insured: quote.insured, vehicles: quote.vehicles, drivers: quote.drivers, additional: quote.additional, coverages: quote.coverages,
    reports: quote.reports, pointOfSale: quote.pointOfSale, ratedSignature: quote.ratedSignature, premiumChange: null,
    // Other products stay listed so the Multi Policy discount is kept on re-rating.
    products: quote.products, productQuotes: key === 'auto' ? {} : { [key]: quote.productQuotes[key as OtherProductKey] },
  };
  return { kind: 'personal', quote: JSON.parse(JSON.stringify(data)) as QuoteData };
}

export function buildPolicies(quote: QuoteData, autoRating: RatingResult, autoRated: boolean, agentName: string, day: string, numbers: Partial<Record<ProductKey, string>>): PolicyRecord[] {
  const { insured, pointOfSale } = quote;
  const phone = insured.phones.find((entry) => entry.number)?.number ?? '';
  const snapshot: InsuredSnapshot = { name: [insured.firstName, insured.middleInitial, insured.lastName, insured.suffix].filter(Boolean).join(' '), firstName: insured.firstName, lastName: insured.lastName, dob: insured.dob, email: insured.email, phone, street: [insured.address.line1, insured.address.line2].filter(Boolean).join(', '), cityStateZip: `${insured.address.city}, ${insured.address.state} ${insured.address.zip}` };
  return productTotals(quote, autoRated).map((total) => {
    const source = personalSource(quote, total.key);
    return newPolicy({ key: total.key, quoteNumber: total.quoteNumber, policyNumber: numbers[total.key] ?? generatePolicyNumber(), plan: total.plan, termMonths: total.termMonths, effectiveDate: quote.policy.effectiveDate, insured: snapshot, drivers: ratedDrivers(quote.drivers).map(driverName), agentCode: quote.policy.agentCode, agentName, day, paymentMethod: pointOfSale.paymentMethod, delivery: pointOfSale.documentDelivery, source, rating: rateSource(source, total.key) });
  });
}

export function buildCommercialPolicies(quote: CommercialQuote, agentCode: string, agentName: string, day: string): PolicyRecord[] {
  const b = quote.business;
  const insured: InsuredSnapshot = { name: b.dba ? `${b.name} DBA ${b.dba}` : b.name, firstName: b.contact ?? '', lastName: b.name, dob: '', email: b.email, phone: b.phone, street: b.street, cityStateZip: `${b.city}, ${b.state} ${b.zip}` };
  const source: PolicySource = { kind: 'commercial', quote: JSON.parse(JSON.stringify(quote)) as CommercialQuote };
  return commercialTotals(quote).map((total) => newPolicy({ key: total.key, quoteNumber: total.quoteNumber, policyNumber: `0${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, plan: total.plan, termMonths: total.termMonths, effectiveDate: quote.effectiveDate, insured, drivers: quote.drivers.map((driver) => [driver.firstName, driver.lastName].filter(Boolean).join(' ')), agentCode, agentName, day, paymentMethod: quote.paymentMethod, delivery: 'In person (print and sign)', source, rating: rateSource(source, total.key) }));
}
