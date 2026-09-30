// Deterministic training rating engine. Every factor is emitted as a line item so the
// VA can see exactly why the premium moved.
import type { Driver, QuoteData, RatingLine, RatingResult, Vehicle } from '@/types/quote';
import { BI_LIMITS, DEDUCTIBLES, MED_PAY, PD_LIMITS, RENTAL, ROADSIDE_MONTHLY, UM_LIMITS, tierFor, type CoverageTier } from '@/data/options';
import { ageOn, ratingDate } from '@/utils/dates';

export const BASE_RATE = 120;
export const OLDER_VEHICLE_YEAR = 2010;
export const OLDER_VEHICLE_CREDIT = -10;
export const NEWER_VEHICLE_YEAR = 2022;
export const NEWER_VEHICLE_SURCHARGE = 25;
export const YOUTHFUL_AGE = 25;
export const YOUTHFUL_SURCHARGE = 45;
export const INCIDENT_SURCHARGE = 35;
export const SAFE_DRIVER_RATE = 0.15;
export const PAPERLESS_SAVINGS = 10;
export const PAY_IN_FULL_RATE = 0.08;
export const POLICY_TERM_MONTHS = 12;

const round2 = (value: number) => Math.round(value * 100) / 100;

export function vehicleLabel(vehicle: Vehicle, index: number): string {
  const description = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return description ? `Vehicle ${index + 1} (${description})` : `Vehicle ${index + 1}`;
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

function coverageLine(lines: RatingLine[], label: string, tiers: CoverageTier[], value: string, name: string) {
  const tier = tierFor(tiers, value);
  if (tier && tier.monthly !== 0) lines.push({ label: `${label}: ${name} ${tier.label}`, amount: tier.monthly, category: 'coverage' });
}

export function rateQuote(quote: QuoteData): RatingResult {
  const lines: RatingLine[] = [];
  const { coverages } = quote;

  quote.vehicles.forEach((vehicle, index) => {
    const label = vehicleLabel(vehicle, index);
    lines.push({ label: `${label}: base rate`, amount: BASE_RATE, category: 'base' });
    const year = Number(vehicle.year);
    if (year && year < OLDER_VEHICLE_YEAR) lines.push({ label: `${label}: pre-${OLDER_VEHICLE_YEAR} model year`, amount: OLDER_VEHICLE_CREDIT, category: 'vehicle' });
    if (year > NEWER_VEHICLE_YEAR) lines.push({ label: `${label}: newer than ${NEWER_VEHICLE_YEAR}`, amount: NEWER_VEHICLE_SURCHARGE, category: 'vehicle' });
    coverageLine(lines, label, BI_LIMITS, coverages.bodilyInjury, 'Bodily Injury');
    coverageLine(lines, label, PD_LIMITS, coverages.propertyDamage, 'Property Damage');
    coverageLine(lines, label, UM_LIMITS, coverages.uninsuredMotorist, 'UM/UIM');
    coverageLine(lines, label, MED_PAY, coverages.medicalPayments, 'Medical Payments');
    coverageLine(lines, label, DEDUCTIBLES, vehicle.compDeductible, 'Comprehensive');
    coverageLine(lines, label, DEDUCTIBLES, vehicle.collDeductible, 'Collision');
    coverageLine(lines, label, RENTAL, coverages.rentalReimbursement, 'Rental');
    if (coverages.roadside === 'Yes') lines.push({ label: `${label}: Roadside Assistance`, amount: ROADSIDE_MONTHLY, category: 'coverage' });
  });

  const on = ratingDate(quote.policy.effectiveDate);
  ratedDrivers(quote.drivers).forEach((driver) => {
    const name = driverName(driver);
    const age = ageOn(driver.dob, on);
    if (age !== null && age < YOUTHFUL_AGE) lines.push({ label: `${name}: driver under ${YOUTHFUL_AGE} (age ${age})`, amount: YOUTHFUL_SURCHARGE, category: 'driver' });
    const incidents = driver.incidents.filter((incident) => incident.code).length;
    if (incidents) lines.push({ label: `${name}: ${incidents} incident${incidents > 1 ? 's' : ''} x $${INCIDENT_SURCHARGE}`, amount: incidents * INCIDENT_SURCHARGE, category: 'driver' });
  });

  const subtotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));

  const { mvrStatus, clueStatus } = quote.reports;
  const flagged = mvrStatus === 'flagged' || clueStatus === 'flagged';
  const safeDriver: RatingResult['safeDriver'] = countIncidents(quote.drivers) > 0 || flagged
    ? 'ineligible'
    : mvrStatus === 'cleared' && clueStatus === 'cleared' ? 'applied' : 'pending';

  const discounts: RatingLine[] = [];
  if (safeDriver === 'applied') discounts.push({ label: `Safe Driver discount (${SAFE_DRIVER_RATE * 100}%)`, amount: -round2(subtotal * SAFE_DRIVER_RATE), category: 'discount' });
  if (quote.additional.paperless === 'Yes' && subtotal > 0) discounts.push({ label: 'Paperless discount', amount: -PAPERLESS_SAVINGS, category: 'discount' });

  const monthlyPremium = Math.max(0, round2(subtotal + discounts.reduce((sum, line) => sum + line.amount, 0)));
  const annualPremium = round2(monthlyPremium * POLICY_TERM_MONTHS);
  const paidInFullPremium = round2(annualPremium * (1 - PAY_IN_FULL_RATE));

  return {
    lines,
    subtotal,
    discounts,
    monthlyPremium,
    annualPremium,
    paidInFullPremium,
    paidInFullSavings: round2(annualPremium - paidInFullPremium),
    discountsApplied: discounts.map((line) => line.label),
    safeDriver,
  };
}
