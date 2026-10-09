// Training rating engine for a 6-month auto policy, built like a filed rating manual: every premium
// is a coverage base rate multiplied by rating factors that come only from the applicant's
// information (drivers, driving record, vehicles, garaging ZIP, coverages, prior insurance and
// discounts). Nothing is random: the same applicant always gets the same premium, and each step is
// recorded in a rating worksheet the agent can open from Coverages/Bill Plans.
//
// Before Point of Sale the quote is rated on the applicant's stated prior insurance and an assumed
// Standard insurance score; once reports are applied, the verified results replace them.
// Base rates and factors are LAVA training values, not any carrier's filed rates.
import type { BillPlan, BillPlanQuote, CoverageKey, CoverageWorksheet, Driver, QuoteData, RatingFactor, RatingResult, RatingWorksheet, Vehicle, VehiclePremium, WorksheetLine } from '@/types/quote';
import type { ProductKey } from '@/products/types';
import { BI_PD, COLL_DEDUCTIBLES, CUSTOM_EQUIPMENT_MAX, ETE, INCIDENT_CODES, MED_PAY, OTC_DEDUCTIBLES, OWNED_RESIDENCES, PIP_OPTIONS, TOWING, UMPD, UM_BI, optionFor, optionLabel } from '@/data/options';
import { rulesFor, stateForZip } from '@/data/states';
import { ageOn, parseDate, ratingDate } from '@/utils/dates';
import { moneyToNumber } from '@/utils/masks';

export const TERM_MONTHS = 6;
export const PAY_IN_FULL_DISCOUNT = 0.11;
export const SCORE_TIER_FACTORS = [0.85, 1, 1.2, 1.45];
export const SCORE_TIER_NAMES = ['Preferred', 'Standard', 'Nonstandard', 'High Risk'];
export const SR22_FILING_FEE = 25;

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const pct = (factor: number) => `${factor >= 1 ? '+' : '−'}${Math.abs(Math.round((factor - 1) * 100))}%`;
const money = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const times = (factor: number) => `×${Number(factor.toFixed(3))}`;

// ------------------------------------------------------------------ names and helpers

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

export function incidentLabel(code: string): string {
  return INCIDENT_CODES.find((entry) => entry.value === code)?.label ?? code;
}

/** A premium built step by step: base rate, then each factor, recorded for the worksheet. */
class Calc {
  readonly lines: WorksheetLine[] = [];
  private value: number;
  constructor(label: string, base: number) {
    this.value = base;
    this.lines.push({ label, value: money(base) });
  }
  /** Applies a factor (factors of exactly 1 are left off the worksheet). */
  by(label: string, factor: number) {
    if (Math.abs(factor - 1) < 0.0005) return this;
    this.value *= factor;
    this.lines.push({ label, value: times(factor) });
    return this;
  }
  get premium() { return round2(this.value); }
}

// ------------------------------------------------------------------ territory

/** Statewide rate level for the state a ZIP is in. */
function stateLevel(zip: string, fallbackState: string): { level: number; state: string } {
  const state = stateForZip(zip) ?? fallbackState;
  return { level: rulesFor(state).rateLevel, state: rulesFor(state).name };
}

/** Territory within the state: metro ZIPs cost more (more traffic, theft and claims). */
function localTerritory(zip: string): number {
  const prefix = zip.slice(0, 3);
  const state = stateForZip(zip);
  if (!state || state === 'North Carolina') return ({ '276': 1, '275': 0.97, '277': 0.95, '282': 1.12, '274': 1.02 } as Record<string, number>)[prefix] ?? 0.93;
  return rulesFor(state).metroPrefixes.includes(prefix) ? 1.12 : 0.96;
}

/** Combined state rate level and territory (used by the other products). */
export function territoryFactor(zip: string): number {
  const state = stateForZip(zip);
  return Math.round((state ? rulesFor(state).rateLevel : 1) * localTerritory(zip) * 1000) / 1000;
}

// ------------------------------------------------------------------ drivers

const NC = 'North Carolina';
/** Months an incident is used in rating. DUI/DWI stays on for 5 years; other incidents for 3. */
const LOOKBACK_MONTHS: Record<string, number> = { DWI: 60 };
/** Surcharge per chargeable incident (states other than North Carolina). */
const INCIDENT_SURCHARGE: Record<string, number> = { AAF: 1.35, SP1: 1.12, SP2: 1.25, FTY: 1.15, RLT: 1.15, DWI: 1.85 };
/** North Carolina Safe Driver Insurance Plan points per incident (training approximation). */
const SDIP_POINTS: Record<string, number> = { AAF: 3, SP1: 1, SP2: 2, FTY: 1, RLT: 1, DWI: 12 };
/** North Carolina SDIP surcharge by total points (0 to 12+). */
const SDIP_SURCHARGE = [1, 1.3, 1.45, 1.6, 1.8, 2.1, 2.35, 2.65, 2.95, 3.25, 3.6, 4, 4.4];

function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

/** Incidents still inside the rating lookback period on the effective date. */
function chargeable(driver: Driver, on: Date, codes?: string[]) {
  return driver.incidents.filter((incident) => {
    if (!incident.code || (codes && !codes.includes(incident.code))) return false;
    const date = parseDate(incident.date);
    return !date || monthsBetween(date, on) <= (LOOKBACK_MONTHS[incident.code] ?? 36);
  });
}

function ageClass(age: number): [string, number] {
  if (age < 18) return ['16-17', 2.45];
  if (age < 20) return ['18-19', 2.05];
  if (age < 22) return ['20-21', 1.72];
  if (age < 25) return ['22-24', 1.42];
  if (age < 30) return ['25-29', 1.15];
  if (age < 35) return ['30-34', 1.03];
  if (age < 50) return ['35-49', 1];
  if (age < 65) return ['50-64', 0.95];
  if (age < 70) return ['65-69', 0.98];
  if (age < 75) return ['70-74', 1.06];
  return ['75+', 1.22];
}

/** A driver's rating factor and how it was built. `state` is the policy state. */
export function driverRating(driver: Driver, on: Date, state = ''): { factor: number; lines: WorksheetLine[] } {
  const lines: WorksheetLine[] = [];
  let factor = 1;
  const apply = (label: string, value: number) => { factor *= value; lines.push({ label, value: times(value) }); };
  const age = ageOn(driver.dob, on);
  if (age === null) lines.push({ label: 'Age unknown: rated as an adult driver', value: times(1) });
  else {
    const [band, value] = ageClass(age);
    apply(`Age ${age} (class ${band})`, value);
    // North Carolina does not allow gender in auto rating.
    if (state !== NC && age < 30) {
      const gender = driver.gender === 'Male' ? (age < 25 ? 1.12 : 1.04) : driver.gender === 'Female' && age < 25 ? 0.94 : 1;
      if (gender !== 1) apply(`Gender (${driver.gender.toLowerCase()}, under ${age < 25 ? 25 : 30})`, gender);
    }
  }
  if (driver.maritalStatus === 'Married' || driver.maritalStatus === 'Domestic Partner') apply(`Marital status (${driver.maritalStatus.toLowerCase()})`, 0.92);
  else if (driver.maritalStatus === 'Widowed') apply('Marital status (widowed)', 0.96);
  const licensedAt = Number(driver.ageFirstLicensed);
  if (age !== null && licensedAt && age >= licensedAt) {
    const years = age - licensedAt;
    if (years < 1) apply('Driving experience: licensed less than 1 year', 1.35);
    else if (years < 3) apply(`Driving experience: licensed ${years} year${years > 1 ? 's' : ''}`, 1.2);
    else if (years < 5) apply(`Driving experience: licensed ${years} years`, 1.08);
  }
  if (age !== null && age < 25 && driver.goodStudent === 'Yes') apply('Good student discount (B average or better)', 0.9);
  if (age !== null && age < 25 && driver.distantStudent === 'Yes') apply('Distant student discount (school 100+ miles away, no car)', 0.8);
  if (driver.licenseStatus && driver.licenseStatus !== 'Valid') apply(`License status: ${driver.licenseStatus.toLowerCase()}`, 1.5);
  if (driver.stateFiling === 'Yes') apply('SR-22/FR-44 state filing', 1.2);

  // Driving record: accidents and violations inside the lookback period.
  const charged = chargeable(driver, on, Object.keys(INCIDENT_SURCHARGE));
  for (const incident of driver.incidents.filter((entry) => entry.code && !charged.includes(entry))) {
    lines.push({ label: `${incidentLabel(incident.code)}${incident.date ? ` (${incident.date})` : ''}: ${incident.code === 'NAF' ? 'not-at-fault, not surcharged' : incident.code === 'CMP' ? 'rated on Other Than Collision only' : `older than ${(LOOKBACK_MONTHS[incident.code] ?? 36) / 12} years, not rated`}`, value: times(1) });
  }
  if (state === NC) {
    const points = charged.reduce((sum, incident) => sum + (SDIP_POINTS[incident.code] ?? 0), 0);
    if (points) apply(`NC Safe Driver Insurance Plan: ${points} point${points > 1 ? 's' : ''} (${charged.map((incident) => incident.code).join(', ')})`, SDIP_SURCHARGE[Math.min(points, 12)]);
  } else {
    for (const incident of charged) apply(`${incidentLabel(incident.code)}${incident.date ? ` (${incident.date})` : ''}`, INCIDENT_SURCHARGE[incident.code]);
  }
  return { factor: Math.round(factor * 1000) / 1000, lines };
}

export function driverFactor(driver: Driver, on: Date, state = ''): number {
  return driverRating(driver, on, state).factor;
}

/** Highest rated-driver factor on the quote (principal operator for toys). */
export function primaryDriverFactor(quote: QuoteData): number {
  const on = ratingDate(quote.policy.effectiveDate);
  return Math.max(1, ...ratedDrivers(quote.drivers).map((driver) => driverFactor(driver, on, quote.policy.quoteState)));
}

// ------------------------------------------------------------------ vehicles

function usageFactor(vehicle: Vehicle): { use: number; miles: number; rideshare: number } {
  const use = vehicle.primaryUse.startsWith('1A') ? 0.95 : vehicle.primaryUse.startsWith('3A') ? 1.12 : vehicle.primaryUse.startsWith('4A') ? 0.9 : 1;
  const annual = moneyToNumber(vehicle.annualMiles.split(' ')[0]);
  const miles = !vehicle.annualMiles ? 1 : annual < 8000 ? 0.93 : annual < 12000 ? 1 : annual < 15000 ? 1.04 : annual < 20000 ? 1.08 : 1.14;
  return { use, miles, rideshare: vehicle.rideshare === 'Yes' ? 1.1 : 1 };
}

// ------------------------------------------------------------------ prior insurance and reports

const PRIOR_YEARS_FACTOR: Record<string, number> = { 'Less than 6 months': 1.08, 'At least 6 months but less than 1 year': 1.02, 'At least 1 year but less than 3 years': 0.95, '3 years or more': 0.9 };
const PRIOR_LIMITS_FACTOR: Record<string, number> = { 'State Minimum Limits': 1.1, '50/100': 1.03, '100/300': 0.97, '250/500 or higher': 0.93, '250/500': 0.93 };
const NO_PRIOR = 1.35;
const LAPSED = 1.2;

export function reportsApplied(quote: QuoteData): boolean {
  return quote.reports.priorSource !== '';
}

/** Prior-insurance factor: the applicant's answers until Point of Sale verifies them. */
export function priorInsuranceFactor(quote: QuoteData): { factor: number; label: string } {
  const { reports, additional } = quote;
  const stated = (years: string, limits: string) => (PRIOR_YEARS_FACTOR[years] ?? 1) * (PRIOR_LIMITS_FACTOR[limits] ?? 1);
  if (reportsApplied(quote) && reports.priorSource === 'vendor' && reports.vendor) {
    const { liabilityStatus, biLimits, length, carrier } = reports.vendor;
    if (liabilityStatus === 'No') return { factor: NO_PRIOR, label: 'Prior insurance (verified): no prior liability coverage found' };
    if (liabilityStatus === 'Yes, not currently insured') return { factor: LAPSED, label: `Prior insurance (verified): coverage lapsed with ${carrier}` };
    return { factor: stated(length, biLimits), label: `Prior insurance (verified): ${carrier}, ${biLimits}, ${length.toLowerCase()}` };
  }
  if (additional.continuousInsurance === 'No') return { factor: NO_PRIOR, label: 'Prior insurance: none in the past 6 months' };
  if (additional.continuousInsurance !== 'Yes') return { factor: 1, label: 'Prior insurance: not answered yet' };
  const factor = stated(additional.priorYears, additional.priorLimits);
  // Kept the applicant's answer over the vendor's: the continuous-insurance credit is not given.
  if (reportsApplied(quote)) return { factor: Math.max(1, factor), label: `Prior insurance (applicant provided, unverified): ${additional.priorCarrier || 'carrier not given'}` };
  return { factor, label: `Prior insurance (applicant provided${additional.priorLimits ? `: ${additional.priorLimits}, ${additional.priorYears.toLowerCase()}` : ''}; verified at Point of Sale)` };
}

// ------------------------------------------------------------------ rating

export function rateQuote(quote: QuoteData): RatingResult {
  const on = ratingDate(quote.policy.effectiveDate);
  const policyState = quote.policy.quoteState;
  const { coverages, additional, reports } = quote;
  const rated = ratedDrivers(quote.drivers);
  const applied = reportsApplied(quote);

  // Drivers: each driver's factor and how it was built.
  const driverRows = rated.map((driver) => ({ driver, ...driverRating(driver, on, policyState) }));
  const highest = driverRows.reduce<(typeof driverRows)[number] | undefined>((top, row) => (!top || row.factor > top.factor ? row : top), undefined);

  // Policy-level factors and discounts.
  const prior = priorInsuranceFactor(quote);
  const score = applied ? SCORE_TIER_FACTORS[reports.scoreTier] ?? 1 : 1;
  const scoreLabel = applied ? `Insurance score: ${SCORE_TIER_NAMES[reports.scoreTier]} (credit-based, from the Point of Sale report)` : 'Insurance score: not ordered yet (Standard assumed)';
  const cancellation = additional.priorCancellation === 'Yes' ? 1.35 : 1;
  const homeowner = OWNED_RESIDENCES.includes(additional.primaryResidence);
  const multiPolicy = additional.crossSell.length > 0 || activeProducts(quote).length > 1;
  const multiCar = quote.vehicles.length > 1;
  const snapshot = coverages.snapshot.startsWith('Enrolled');
  const paperless = additional.paperless === 'Yes';
  const cmpClaims = rated.reduce((count, driver) => count + chargeable(driver, on, ['CMP']).length, 0);

  const appliedDiscounts: string[] = [];
  if (multiCar) appliedDiscounts.push('Multi Car');
  if (homeowner) appliedDiscounts.push('Homeowner');
  if (multiPolicy) appliedDiscounts.push('Multi Policy');
  if (snapshot) appliedDiscounts.push('DriveSense Participation');
  if (paperless) appliedDiscounts.push('Paperless');
  if (prior.factor < 1) appliedDiscounts.push('Continuous Insurance');
  if (rated.some((driver) => driver.goodStudent === 'Yes' && (ageOn(driver.dob, on) ?? 99) < 25)) appliedDiscounts.push('Good Student');
  if (rated.some((driver) => driver.distantStudent === 'Yes' && (ageOn(driver.dob, on) ?? 99) < 25)) appliedDiscounts.push('Distant Student');

  const discount = (calc: Calc, which: ('car' | 'home' | 'policy' | 'sense' | 'paper')[]) => {
    if (which.includes('car') && multiCar) calc.by('Multi-car discount', 0.88);
    if (which.includes('home') && homeowner) calc.by('Homeowner discount', 0.93);
    if (which.includes('policy') && multiPolicy) calc.by('Multi-policy discount', 0.92);
    if (which.includes('sense') && snapshot) calc.by('DriveSense participation discount', 0.9);
    if (which.includes('paper') && paperless) calc.by('Paperless discount', 0.97);
    return calc;
  };

  const worksheetVehicles: RatingWorksheet['vehicles'] = [];
  const vehicles: VehiclePremium[] = quote.vehicles.map((vehicle, index) => {
    const label = vehicleLabel(vehicle, index);
    const zip = vehicle.garagingZip;
    const level = stateLevel(zip, policyState);
    const territory = localTerritory(zip);
    // Principal driver: the highest-rated driver assigned to this vehicle (else the highest on the policy).
    const assigned = driverRows.filter((row) => row.driver.primaryVehicleId === vehicle.id);
    const principal = assigned.reduce<(typeof driverRows)[number] | undefined>((top, row) => (!top || row.factor > top.factor ? row : top), undefined) ?? highest;
    const principalFactor = principal?.factor ?? 1;
    // Occasional drivers: everyone else who may drive it (youthful occasional drivers raise the rate).
    const others = driverRows.filter((row) => row !== principal && (row.driver.primaryVehicleId === vehicle.id || !quote.vehicles.some((entry) => entry.id === row.driver.primaryVehicleId)));
    const occasional = others.length ? 1 + 0.35 * Math.max(0, Math.max(...others.map((row) => row.factor)) - 1) : 1;
    const occasionalName = others.length ? driverName(others.reduce((top, row) => (row.factor > top.factor ? row : top)).driver) : '';
    const usage = usageFactor(vehicle);
    const liabilitySymbol = clamp((Number(vehicle.isoSymbol) || 15) / 15, 0.8, 1.6);
    const otcSymbol = clamp((Number(vehicle.isoSymbolOtc) || 38) / 38, 0.7, 1.7);
    const collSymbol = clamp((Number(vehicle.isoSymbolCollision) || 41) / 41, 0.7, 1.7);
    const marketValue = moneyToNumber(vehicle.marketValue) || 15000;
    const value = clamp(Math.sqrt(marketValue / 15000), 0.5, 1.6);
    const airbag = vehicle.passiveRestraint === 'Airbag - Full';
    if (airbag) appliedDiscounts.push(`Airbag full for vehicle ${index + 1}`);
    const equipment = Math.min(moneyToNumber(vehicle.customEquipment), CUSTOM_EQUIPMENT_MAX);
    const principalLabel = principal ? `Principal driver: ${driverName(principal.driver)}` : 'Principal driver: none listed';
    const where = (calc: Calc) => calc.by(`${level.state} rate level`, level.level).by(`Territory (garaging ZIP ${zip || '—'})`, territory);
    const driving = (calc: Calc) => calc.by(principalLabel, principalFactor).by(`Occasional driver: ${occasionalName}`, occasional);
    const history = (calc: Calc) => calc.by(prior.label, prior.factor).by(scoreLabel, score).by('Prior policy cancellation by an insurer', cancellation);
    const sheets: CoverageWorksheet[] = [];
    const sheet = (key: CoverageKey, coverage: string, limit: string, calc: Calc | null, flat?: number) => {
      const premium = calc ? calc.premium : round2(flat ?? 0);
      sheets.push({ coverage, limit, lines: calc ? calc.lines : [{ label: flat ? 'Flat rate per vehicle' : 'Not selected', value: money(flat ?? 0) }], premium });
      return [key, premium] as const;
    };

    const biBase = optionFor(BI_PD, coverages.bodilyInjuryPd)?.base ?? 0;
    const medBase = optionFor(MED_PAY, coverages.medicalPayments)?.base ?? 0;
    const otcBase = optionFor(OTC_DEDUCTIBLES, vehicle.compDeductible)?.base ?? 0;
    const collBase = optionFor(COLL_DEDUCTIBLES, vehicle.collDeductible)?.base ?? 0;

    const bi = biBase ? discount(history(driving(where(new Calc(`Base rate (${optionLabel(BI_PD, coverages.bodilyInjuryPd)})`, biBase)).by(`Vehicle liability symbol ${vehicle.isoSymbol || '—'}`, liabilitySymbol).by(`Primary use (${vehicle.primaryUse || '—'})`, usage.use).by(`Annual miles (${vehicle.annualMiles || '—'})`, usage.miles).by('Rideshare use', usage.rideshare))), ['car', 'home', 'policy', 'sense', 'paper']) : null;
    const med = medBase ? discount(where(new Calc(`Base rate (${optionLabel(MED_PAY, coverages.medicalPayments)} each person)`, medBase)).by('Full front and side airbags', airbag ? 0.8 : 1).by(`Driver (${principal ? driverName(principal.driver) : 'none'}), injury exposure`, Math.sqrt(principalFactor)), ['car', 'paper']) : null;
    const otc = otcBase ? discount(where(new Calc(`Base rate ($${vehicle.compDeductible} deductible)`, otcBase)).by(`Vehicle comprehensive symbol ${vehicle.isoSymbolOtc || '—'}`, otcSymbol).by(`Vehicle value ($${marketValue.toLocaleString('en-US')})`, value).by(scoreLabel, score).by(`Comprehensive claims in the past 3 years (${cmpClaims})`, cmpClaims ? 1.1 ** cmpClaims : 1), ['car', 'home', 'policy', 'paper']) : null;
    const coll = collBase ? discount(history(driving(where(new Calc(`Base rate ($${vehicle.collDeductible} deductible)`, collBase)).by(`Vehicle collision symbol ${vehicle.isoSymbolCollision || '—'}`, collSymbol).by(`Vehicle value ($${marketValue.toLocaleString('en-US')})`, value).by(`Primary use (${vehicle.primaryUse || '—'})`, usage.use).by(`Annual miles (${vehicle.annualMiles || '—'})`, usage.miles).by('Rideshare use', usage.rideshare))), ['car', 'home', 'policy', 'sense', 'paper']) : null;
    const coveragesPremium = Object.fromEntries([
      sheet('bipd', 'Bodily Injury & Property Damage', optionLabel(BI_PD, coverages.bodilyInjuryPd), bi),
      sheet('medpay', 'Medical Payments', optionLabel(MED_PAY, coverages.medicalPayments), med),
      sheet('otc', 'Other Than Collision (Comprehensive)', optionLabel(OTC_DEDUCTIBLES, vehicle.compDeductible), otc),
      sheet('coll', 'Collision', optionLabel(COLL_DEDUCTIBLES, vehicle.collDeductible), coll),
      sheet('ete', 'Extended Transportation Expense', optionLabel(ETE, vehicle.rental), null, optionFor(ETE, vehicle.rental)?.base ?? 0),
      sheet('towing', 'Towing and Labor', optionLabel(TOWING, vehicle.roadside), null, optionFor(TOWING, vehicle.roadside)?.base ?? 0),
      // The first $1,000 of custom equipment is included at no charge; $9 per $1,000 after that.
      sheet('cec', 'Customizing Equipment', `$${equipment.toLocaleString('en-US')}`, null, Math.max(0, equipment - 1000) / 1000 * 9),
    ]) as Record<CoverageKey, number>;
    const total = round2(Object.values(coveragesPremium).reduce((sum, amount) => sum + amount, 0));
    worksheetVehicles.push({ label, principal: principal ? driverName(principal.driver) : '—', coverages: sheets, total });
    return { vehicleId: vehicle.id, label, coverages: coveragesPremium, total };
  });

  // Policy-level coverages, rated per vehicle on the first vehicle's garaging location.
  const count = quote.vehicles.length;
  const firstZip = quote.vehicles[0]?.garagingZip ?? '';
  const level = stateLevel(firstZip, policyState);
  const policySheets: CoverageWorksheet[] = [];
  const policyCoverage = (coverage: string, limit: string, base: number, territorial: boolean) => {
    if (!base) { policySheets.push({ coverage, limit, lines: [{ label: 'Not selected', value: money(0) }], premium: 0 }); return 0; }
    const calc = new Calc(`Base rate per vehicle (${limit})`, base).by(`Vehicles on the policy (${count})`, count);
    if (territorial) calc.by(`${level.state} rate level`, level.level).by(`Territory (garaging ZIP ${firstZip || '—'})`, localTerritory(firstZip));
    policySheets.push({ coverage, limit, lines: calc.lines, premium: calc.premium });
    return calc.premium;
  };
  const umbi = policyCoverage('Uninsured/Underinsured Motorist Bodily Injury', optionLabel(UM_BI, coverages.uninsuredMotorist), optionFor(UM_BI, coverages.uninsuredMotorist)?.base ?? 0, true);
  const umpd = policyCoverage('Uninsured Motorist Property Damage', optionLabel(UMPD, coverages.umpd), optionFor(UMPD, coverages.umpd)?.base ?? 0, false);
  const pip = policyCoverage('Personal Injury Protection', optionLabel(PIP_OPTIONS, coverages.pip ?? ''), optionFor(PIP_OPTIONS, coverages.pip ?? '')?.base ?? 0, true);
  const filings = rated.filter((driver) => driver.stateFiling === 'Yes');
  const fees = filings.map((driver) => ({ label: `SR-22/FR-44 filing fee (${driverName(driver)})`, amount: SR22_FILING_FEE }));
  const fullTermPremium = round2(vehicles.reduce((sum, vehicle) => sum + vehicle.total, 0) + umbi + umpd + pip + fees.reduce((sum, fee) => sum + fee.amount, 0));

  const billPlans = buildBillPlans(fullTermPremium, TERM_MONTHS);
  if (quote.pointOfSale.billPlan === 'PIF' || quote.pointOfSale.billPlan === '') appliedDiscounts.splice(1, 0, 'Paid in Full');

  const factors: RatingFactor[] = [
    { label: scoreLabel, value: pct(score) },
    { label: prior.label, value: pct(prior.factor) },
    ...driverRows.map((row) => ({ label: `Driver: ${driverName(row.driver)}`, value: pct(row.factor) })),
    ...(cancellation > 1 ? [{ label: 'Prior policy cancellation', value: pct(cancellation) }] : []),
    { label: `Territory (garaging ZIP ${firstZip || '—'})`, value: pct(territoryFactor(firstZip)) },
    ...(multiCar ? [{ label: 'Multi-car discount', value: '−12%' }] : []),
    ...(homeowner ? [{ label: 'Homeowner discount', value: '−7%' }] : []),
    ...(multiPolicy ? [{ label: 'Multi-policy discount', value: '−8%' }] : []),
    ...(snapshot ? [{ label: 'DriveSense participation discount', value: '−10%' }] : []),
    ...(paperless ? [{ label: 'Paperless discount', value: '−3%' }] : []),
    { label: 'Paid in Full discount (Pay In Full plan only)', value: `−${PAY_IN_FULL_DISCOUNT * 100}%` },
  ];

  return {
    vehicles,
    umbi,
    umpd,
    pip,
    fullTermPremium,
    billPlans,
    appliedDiscounts,
    eligibleDiscounts: [...(multiPolicy ? [] : ['Multi Policy']), ...(snapshot ? [] : ['DriveSense Participation'])],
    factors,
    reportsApplied: applied,
    fees,
    worksheet: { vehicles: worksheetVehicles, policy: policySheets, drivers: driverRows.map((row) => ({ name: driverName(row.driver), lines: row.lines, factor: row.factor })) },
  };
}

// ------------------------------------------------------------------ bill plans

function installmentPlan(id: BillPlanQuote['id'], name: string, detail: string, full: number, downRate: number, payments: number, fee: number, termMonths: number): Omit<BillPlanQuote, 'savings'> {
  const dueToday = round2(full * downRate);
  const paymentAmount = round2((full - dueToday) / payments + fee);
  const total = round2(dueToday + paymentAmount * payments);
  return { id, name, detail, dueToday, payments, paymentAmount, total, percentDown: dueToday / total, feePerPayment: fee, termMonths };
}

/** Bill plans for a 6-month (5 installments) or 12-month (11 installments) term. */
export function buildBillPlans(full: number, termMonths = TERM_MONTHS): BillPlanQuote[] {
  const annual = termMonths === 12;
  const pif = round2(full * (1 - (annual ? 0.08 : PAY_IN_FULL_DISCOUNT)));
  const monthly = annual ? 11 : 5;
  const down = annual ? 1 / 12 : 0.2;
  const plans = [
    { id: 'PIF' as const, name: 'Pay In Full', detail: 'Paid In Full', dueToday: pif, payments: 0, paymentAmount: 0, total: pif, percentDown: 1, feePerPayment: 0, termMonths },
    installmentPlan('EFT', 'Pay With EFT', 'From Checking', full, down, monthly, 3, termMonths),
    installmentPlan('CARD', 'Pay With Automatic Card', 'Recurring Credit Card', full, down, monthly, 3, termMonths),
    installmentPlan('MAIL', 'Pay By Mail', 'Paper Bill', full, annual ? down : 0.18, monthly, 8, termMonths),
    installmentPlan('EFT2', 'Pay With EFT - 2 Payments', 'From Checking', full, 0.5, 1, 3, termMonths),
    installmentPlan('MAIL2', 'Pay By Mail - 2 Payments', 'Paper Bill', full, 0.5, 1, 8, termMonths),
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
  const drivers = quote.drivers.map((driver) => [driver.id, driver.dob, driver.gender, driver.driverStatus, driver.maritalStatus, driver.stateFiling, driver.ageFirstLicensed, driver.licenseStatus, driver.goodStudent, driver.distantStudent, driver.primaryVehicleId, driver.incidents.map((incident) => [incident.code, incident.date])]);
  const { reports } = quote;
  return JSON.stringify([quote.policy.effectiveDate, quote.policy.quoteState, vehicles, drivers, quote.coverages, quote.additional, reports.clueStatus, reports.priorSource, reports.scoreTier, reports.vendor]);
}

/** Products currently on the quote (suspended products are excluded). */
export function activeProducts(quote: QuoteData): ProductKey[] {
  return (quote.products ?? ['auto']).filter((key) => key === 'auto' || !quote.productQuotes?.[key]?.suspended);
}

export function hasAuto(quote: QuoteData): boolean {
  return activeProducts(quote).includes('auto');
}

export function isRated(quote: QuoteData): boolean {
  return quote.ratedSignature !== '' && quote.ratedSignature === ratingSignature(quote);
}
