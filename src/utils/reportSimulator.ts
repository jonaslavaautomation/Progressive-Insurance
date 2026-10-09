// Simulated Point of Sale vendor order: Auto CLUE (claims + prior insurance history), MVR (driving
// record) and an insurance-score tier. Nothing is random: CLUE and MVR return the accidents and
// violations entered for each driver, the prior-insurance report confirms the applicant's answers,
// and the insurance score is Standard unless a trainer sets another result in Trainer Mode.
import type { Driver, QuoteData, SimulatedReports, VendorHistory } from '@/types/quote';
import { INCIDENT_CODES } from '@/data/options';
import { driverName, ratedDrivers } from '@/utils/ratingEngine';
import { formatDate } from '@/utils/dates';

export const REPORT_DELAY_MS = 2000;

const LIMITS = ['State Minimum Limits', '50/100', '100/300', '250/500 or higher'];
const LENGTHS = ['Less than 6 months', 'At least 6 months but less than 1 year', 'At least 1 year but less than 3 years', '3 years or more'];

export function emptyReports(requestId = 0): SimulatedReports {
  return { orderClue: true, orderMvr: false, clueStatus: 'not-ordered', mvrStatus: 'not-ordered', clueFindings: [], mvrFindings: [], vendor: null, priorSource: '', scoreTier: 1, simulation: { scoreTier: 1, prior: 'stated' }, orderedAt: '', staleReason: '', requestId };
}

const simulationOf = (quote: QuoteData) => quote.reports.simulation ?? { scoreTier: 1, prior: 'stated' as const };

/**
 * The prior-insurance vendor confirms what the applicant stated. In Trainer Mode the trainer can make
 * it find a lapse or no prior coverage to practice the "Auto Insurance History" discrepancy.
 */
export function vendorHistoryFor(quote: QuoteData): VendorHistory {
  const { additional } = quote;
  const outcome = simulationOf(quote).prior;
  const carrier = (additional.priorCarrier || 'Other standard carrier').toUpperCase();
  if (outcome === 'none' || (outcome === 'stated' && additional.continuousInsurance !== 'Yes')) return { liabilityStatus: 'No', carrier: 'NO PRIOR CARRIER FOUND', biLimits: '—', length: '—' };
  return {
    liabilityStatus: outcome === 'lapsed' ? 'Yes, not currently insured' : 'Yes, currently insured',
    carrier,
    biLimits: additional.priorLimits || LIMITS[0],
    length: outcome === 'lapsed' ? LENGTHS[0] : additional.priorYears || LENGTHS[0],
  };
}

/** The simulated credit report's insurance-score tier (Standard unless the trainer chooses another). */
export function scoreTierFor(quote: QuoteData): number {
  return simulationOf(quote).scoreTier;
}

/** Vendor answer to "liability coverage for past 6 months with no more than a 31-day lapse". */
export function vendorAnswer(vendor: VendorHistory): 'Yes' | 'No' {
  return vendor.liabilityStatus === 'No' ? 'No' : 'Yes';
}

/** True when the prior-insurance report disagrees with any of the applicant's prior-insurance answers. */
export function vendorDiffers(vendor: VendorHistory, quote: QuoteData): boolean {
  const { additional } = quote;
  if (vendorAnswer(vendor) !== additional.continuousInsurance) return true;
  if (additional.continuousInsurance !== 'Yes') return false;
  return vendor.liabilityStatus !== 'Yes, currently insured' || vendor.biLimits !== additional.priorLimits || vendor.length !== additional.priorYears;
}

export function buildFindings(drivers: Driver[]) {
  const mvrFindings: string[] = [];
  const clueFindings: string[] = [];
  ratedDrivers(drivers).forEach((driver) => {
    const name = driverName(driver);
    if (driver.licenseStatus && driver.licenseStatus !== 'Valid') mvrFindings.push(`${name}: license status ${driver.licenseStatus}`);
    driver.incidents.forEach((incident) => {
      const code = INCIDENT_CODES.find((entry) => entry.value === incident.code);
      if (!code) return;
      const finding = `${name}: ${code.label}${incident.date ? ` (${incident.date})` : ''}`;
      // Violations and at-fault accidents appear on the MVR; accidents and claims appear on CLUE.
      if (code.kind === 'violation' || code.value === 'AAF') mvrFindings.push(finding);
      if (code.kind !== 'violation') clueFindings.push(finding);
    });
  });
  return { mvrFindings, clueFindings };
}

export interface PosOrderResult {
  requestId: number;
  vendor: VendorHistory;
  scoreTier: number;
  clueFindings: string[];
  mvrFindings: string[];
  orderedAt: string;
}

/** Resolves after a realistic vendor delay with the simulated order results. */
export function simulatePosOrder(quote: QuoteData, requestId: number): Promise<PosOrderResult> {
  const findings = buildFindings(quote.drivers);
  const result: PosOrderResult = { requestId, vendor: vendorHistoryFor(quote), scoreTier: scoreTierFor(quote), ...findings, orderedAt: formatDate(new Date()) };
  return new Promise((resolve) => { window.setTimeout(() => resolve(result), REPORT_DELAY_MS); });
}
