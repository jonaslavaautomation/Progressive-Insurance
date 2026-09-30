// Deterministic training rating engine for a 6-month auto policy.
// Before Point of Sale the quote is rated on a preliminary tier (insured-provided data only);
// once MVR/CLUE/prior-insurance reports are applied, verified factors replace the preliminary ones.
import type { BillPlan, BillPlanQuote, CoverageKey, Driver, QuoteData, RatingFactor, RatingResult, Vehicle, VehiclePremium } from '@/types/quote';
import { BI_PD, COLL_DEDUCTIBLES, CUSTOM_EQUIPMENT_MAX, ETE, INCIDENT_CODES, MED_PAY, OTC_DEDUCTIBLES, OWNED_RESIDENCES, TOWING, UMPD, UM_BI, optionFor } from '@/data/options';
import { ageOn, ratingDate } from '@/utils/dates';
import { moneyToNumber } from '@/utils/masks';

export const TERM_MONTHS = 6;
export const PAY_IN_FULL_DISCOUNT = 0.11;
export const SCORE_TIER_FACTORS = [0.88, 1, 1.22, 1.46];
export const SCORE_TIER_NAMES = ['Preferred', 'Standard', 'Nonstandard', 'High Risk'];

const INCIDENT_FACTORS: Record<string, number> = { AAF: 1.4, NAF: 1, SP1: 1.15, SP2: 1.3, FTY: 1.18, RLT: 1.2, DWI: 1.9, CMP: 1.05 };
const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const pct = (factor: number) => `${factor >= 1 ? '+' : '−'}${Math.abs(Math.round((factor - 1) * 100))}%`;

export function vehicleLabel(vehicle: Vehicle, index: number): string {
  const description = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return description ? `Vehicle ${index + 1} (${description})` : `Vehicle ${index + 1}`;
}

export function vehicleName(vehicle: Vehicle): string {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'New Vehicle';
}

export function driverName(driver: Driver): string {
  return [driver.firstName, driver.lastName].filter(Boolean).join(' ') || 'New Household Member';
}

export function ratedDrivers(drivers: Driver[]): Driver[] {
  return drivers.filter((driver) => driver.driverStatus === 'Rated');
}

export function countIncidents(drivers: Driver[]): number {
  return ratedDrivers(drivers).reduce((count, driver) => count + driver.incidents.filter((incident) => incident.code).length, 0);
}

function driverFactor(driver: Driver, on: Date): number {
  const age = ageOn(driver.dob, on);
  let factor = age === null ? 1 : age < 20 ? 2.1 : age < 25 ? 1.65 : age < 30 ? 1.2 : age < 65 ? 1 : age < 75 ? 1.08 : 1.2;
  const licensedAt = Number(driver.ageFirstLicensed);
  if (age !== null && licensedAt && age - licensedAt < 3) factor *= 1.15;
  if (driver.maritalStatus === 'Married') factor *= 0.95;
  if (driver.stateFiling === 'Yes') factor *= 1.25;
  for (const incident of driver.incidents) factor *= INCIDENT_FACTORS[incident.code] ?? 1;
  return factor;
}

function territoryFactor(zip: string): number {
  const prefix = zip.slice(0, 3);
  return ({ '276': 1, '275': 0.97, '277': 0.95, '282': 1.12, '274': 1.02 } as Record<string, number>)[prefix] ?? 0.93;
}

function usageFactor(vehicle: Vehicle): number {
  const use = vehicle.primaryUse.startsWith('1A') ? 0.95 : vehicle.primaryUse.startsWith('3A') ? 1.12 : vehicle.primaryUse.startsWith('4A') ? 0.9 : 1;
  const miles = moneyToNumber(vehicle.annualMiles.split(' ')[0]);
  const mileage = !vehicle.annualMiles ? 1 : miles < 8000 ? 0.93 : miles < 12000 ? 1 : miles < 15000 ? 1.04 : miles < 20000 ? 1.08 : 1.14;
  return use * mileage * (vehicle.rideshare === 'Yes' ? 1.1 : 1);
}

/** Prior-insurance factor: preliminary until reports are applied, then verified. */
export function priorInsuranceFactor(quote: QuoteData): { factor: number; label: string } {
  const { reports, additional } = quote;
  const posDone = reports.clueStatus === 'cleared' || reports.clueStatus === 'flagged' || reports.priorSource !== '';
  if (!posDone) return { factor: 1, label: 'Prior insurance: preliminary (pending Point of Sale)' };
  if (reports.priorSource === 'vendor' && reports.vendor) {
    const { liabilityStatus, biLimits, length } = reports.vendor;
    if (liabilityStatus === 'No') return { factor: 1.72, label: 'Prior insurance (vendor): no prior liability coverage' };
    if (liabilityStatus === 'Yes, not currently insured') return { factor: 1.38, label: 'Prior insurance (vendor): coverage lapsed' };
    const lengthFactor = length.includes('3 years or more') || length.startsWith('At least 1 year') ? 0.92 : 1;
    return { factor: lengthFactor * (biLimits === 'State Minimum Limits' ? 1.06 : 1), label: `Prior insurance (vendor): ${length.toLowerCase()}, ${biLimits}` };
  }
  return additional.continuousInsurance === 'Yes'
    ? { factor: 1.05, label: 'Prior insurance (insured provided, unverified)' }
    : { factor: 1.72, label: 'Prior insurance (insured provided): none' };
}

export function reportsApplied(quote: QuoteData): boolean {
  return quote.reports.priorSource !== '';
}

export function rateQuote(quote: QuoteData): RatingResult {
  const on = ratingDate(quote.policy.effectiveDate);
  const { coverages, additional, reports } = quote;
  const rated = ratedDrivers(quote.drivers);
  const applied = reportsApplied(quote);
  const factorsOf = new Map(rated.map((driver) => [driver.id, driverFactor(driver, on)]));
  const maxDriver = Math.max(1, ...factorsOf.values());
  const extraDrivers = Math.max(0, rated.length - quote.vehicles.length) * 0.2;

  const prior = priorInsuranceFactor(quote);
  const score = applied ? SCORE_TIER_FACTORS[reports.scoreTier] ?? 1 : 1;
  const cancellation = additional.priorCancellation === 'Yes' ? 1.35 : 1;
  const homeowner = OWNED_RESIDENCES.includes(additional.primaryResidence);
  const multiPolicy = additional.crossSell.length > 0;
  const snapshot = coverages.snapshot.startsWith('Enrolled');
  const paperless = additional.paperless === 'Yes';
  const discount = (homeowner ? 0.93 : 1) * (multiPolicy ? 0.92 : 1) * (snapshot ? 0.85 : 1) * (paperless ? 0.97 : 1);
  const policyLoad = prior.factor * score * cancellation * discount;

  const appliedDiscounts: string[] = [];
  if (homeowner) appliedDiscounts.push('Homeowner');
  if (multiPolicy) appliedDiscounts.push('Multi Policy');
  if (snapshot) appliedDiscounts.push('Snapshot Participation');
  if (paperless) appliedDiscounts.push('Paperless');
  if (prior.factor < 1) appliedDiscounts.push('Continuous Insurance');

  const vehicles: VehiclePremium[] = quote.vehicles.map((vehicle, index) => {
    const assigned = rated.filter((driver) => driver.primaryVehicleId === vehicle.id).map((driver) => factorsOf.get(driver.id) ?? 1);
    const driverLoad = (assigned.length ? Math.max(...assigned) : maxDriver) * (1 + extraDrivers);
    const territory = territoryFactor(vehicle.garagingZip);
    const usage = usageFactor(vehicle);
    const liabilitySymbol = clamp((Number(vehicle.isoSymbol) || 15) / 15, 0.8, 1.6);
    const otcSymbol = clamp((Number(vehicle.isoSymbolOtc) || 38) / 38, 0.7, 1.7);
    const collSymbol = clamp((Number(vehicle.isoSymbolCollision) || 41) / 41, 0.7, 1.7);
    const value = clamp(Math.sqrt((moneyToNumber(vehicle.marketValue) || 15000) / 15000), 0.5, 1.6);
    const airbag = vehicle.passiveRestraint === 'Airbag - Full';
    if (airbag) appliedDiscounts.push(`Airbag full for vehicle ${index + 1}`);
    const equipment = Math.min(moneyToNumber(vehicle.customEquipment), CUSTOM_EQUIPMENT_MAX);

    const coveragesPremium: Record<CoverageKey, number> = {
      bipd: round2((optionFor(BI_PD, coverages.bodilyInjuryPd)?.base ?? 0) * liabilitySymbol * territory * usage * driverLoad * policyLoad),
      medpay: round2((optionFor(MED_PAY, coverages.medicalPayments)?.base ?? 0) * territory * (airbag ? 0.8 : 1) * Math.sqrt(driverLoad)),
      otc: round2((optionFor(OTC_DEDUCTIBLES, vehicle.compDeductible)?.base ?? 0) * otcSymbol * value * territory * score * discount),
      coll: round2((optionFor(COLL_DEDUCTIBLES, vehicle.collDeductible)?.base ?? 0) * collSymbol * value * territory * usage * driverLoad * policyLoad),
      ete: optionFor(ETE, vehicle.rental)?.base ?? 0,
      towing: optionFor(TOWING, vehicle.roadside)?.base ?? 0,
      // The first $1,000 of custom equipment is included at no charge.
      cec: round2(Math.max(0, equipment - 1000) / 1000 * 9),
    };
    const total = round2(Object.values(coveragesPremium).reduce((sum, amount) => sum + amount, 0));
    return { vehicleId: vehicle.id, label: vehicleLabel(vehicle, index), coverages: coveragesPremium, total };
  });

  const count = quote.vehicles.length;
  const umbi = round2((optionFor(UM_BI, coverages.uninsuredMotorist)?.base ?? 0) * count * territoryFactor(quote.vehicles[0]?.garagingZip ?? ''));
  const umpd = round2((optionFor(UMPD, coverages.umpd)?.base ?? 0) * count);
  const fullTermPremium = round2(vehicles.reduce((sum, vehicle) => sum + vehicle.total, 0) + umbi + umpd);

  const billPlans = buildBillPlans(fullTermPremium);
  if (quote.pointOfSale.billPlan === 'PIF' || quote.pointOfSale.billPlan === '') appliedDiscounts.splice(1, 0, 'Paid in Full');

  const factors: RatingFactor[] = [
    { label: 'Rating tier', value: applied ? `${SCORE_TIER_NAMES[reports.scoreTier]} (${pct(score)})` : 'Preliminary (reports not yet ordered)' },
    { label: prior.label, value: pct(prior.factor) },
    { label: 'Primary driver factor', value: pct(maxDriver) },
    ...(extraDrivers ? [{ label: 'Additional drivers', value: pct(1 + extraDrivers) }] : []),
    ...(cancellation > 1 ? [{ label: 'Prior policy cancellation', value: pct(cancellation) }] : []),
    { label: 'Territory (garaging ZIP)', value: pct(territoryFactor(quote.vehicles[0]?.garagingZip ?? '')) },
    ...(homeowner ? [{ label: 'Homeowner discount', value: '−7%' }] : []),
    ...(multiPolicy ? [{ label: 'Multi Policy discount', value: '−8%' }] : []),
    ...(snapshot ? [{ label: 'Snapshot participation discount', value: '−15%' }] : []),
    ...(paperless ? [{ label: 'Paperless discount', value: '−3%' }] : []),
    { label: 'Paid in Full discount (Pay In Full plan only)', value: `−${PAY_IN_FULL_DISCOUNT * 100}%` },
  ];

  return {
    vehicles,
    umbi,
    umpd,
    fullTermPremium,
    billPlans,
    appliedDiscounts,
    eligibleDiscounts: [...(multiPolicy ? [] : ['Multi Policy']), ...(snapshot ? [] : ['Snapshot Participation'])],
    factors,
    reportsApplied: applied,
  };
}

function installmentPlan(id: BillPlanQuote['id'], name: string, detail: string, full: number, downRate: number, payments: number, fee: number): Omit<BillPlanQuote, 'savings'> {
  const dueToday = round2(full * downRate);
  const paymentAmount = round2((full - dueToday) / payments + fee);
  const total = round2(dueToday + paymentAmount * payments);
  return { id, name, detail, dueToday, payments, paymentAmount, total, percentDown: dueToday / total, feePerPayment: fee };
}

export function buildBillPlans(full: number): BillPlanQuote[] {
  const pif = round2(full * (1 - PAY_IN_FULL_DISCOUNT));
  const plans = [
    { id: 'PIF' as const, name: 'Pay In Full', detail: 'Paid In Full', dueToday: pif, payments: 0, paymentAmount: 0, total: pif, percentDown: 1, feePerPayment: 0 },
    installmentPlan('EFT', 'Pay With EFT', 'From Checking', full, 0.2, 5, 3),
    installmentPlan('CARD', 'Pay With Automatic Card', 'Recurring Credit Card', full, 0.2, 5, 3),
    installmentPlan('MAIL', 'Pay By Mail', 'Paper Bill', full, 0.18, 5, 8),
    installmentPlan('EFT2', 'Pay With EFT - 2 Payments', 'From Checking', full, 0.5, 1, 3),
    installmentPlan('MAIL2', 'Pay By Mail - 2 Payments', 'Paper Bill', full, 0.5, 1, 8),
  ];
  const mail = plans.find((plan) => plan.id === 'MAIL')?.total ?? pif;
  return plans.map((plan) => ({ ...plan, savings: plan.id === 'PIF' ? round2(mail - pif) : 0 }));
}

export function selectedPlan(rating: RatingResult, billPlan: BillPlan): BillPlanQuote {
  return rating.billPlans.find((plan) => plan.id === billPlan) ?? rating.billPlans[0];
}

/** Everything that affects price. A change means the quote must be RECALCULATEd. */
export function ratingSignature(quote: QuoteData): string {
  const vehicles = quote.vehicles.map((vehicle) => [vehicle.id, vehicle.year, vehicle.isoSymbol, vehicle.isoSymbolOtc, vehicle.isoSymbolCollision, vehicle.garagingZip, vehicle.primaryUse, vehicle.annualMiles, vehicle.rideshare, vehicle.marketValue, vehicle.passiveRestraint, vehicle.compDeductible, vehicle.collDeductible, vehicle.rental, vehicle.roadside, vehicle.customEquipment]);
  const drivers = quote.drivers.map((driver) => [driver.id, driver.dob, driver.driverStatus, driver.maritalStatus, driver.stateFiling, driver.ageFirstLicensed, driver.primaryVehicleId, driver.incidents.map((incident) => [incident.code, incident.date])]);
  const { reports } = quote;
  return JSON.stringify([quote.policy.effectiveDate, vehicles, drivers, quote.coverages, quote.additional, reports.clueStatus, reports.priorSource, reports.scoreTier, reports.vendor]);
}

export function isRated(quote: QuoteData): boolean {
  return quote.ratedSignature !== '' && quote.ratedSignature === ratingSignature(quote);
}

export function incidentLabel(code: string): string {
  return INCIDENT_CODES.find((entry) => entry.value === code)?.label ?? code;
}
