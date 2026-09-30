// Simulated Point of Sale vendor order: Auto CLUE (claims + prior insurance history),
// MVR (driving record) and an insurance-score tier. Results are deterministic for a given
// customer so a trainee sees the same outcome when re-ordering, and are derived only from
// data entered in this session.
import type { Driver, QuoteData, SimulatedReports, VendorHistory } from '@/types/quote';
import { INCIDENT_CODES } from '@/data/options';
import { driverName, ratedDrivers } from '@/utils/ratingEngine';
import { formatDate } from '@/utils/dates';

export const REPORT_DELAY_MS = 2000;

const CARRIERS = ['STATE FARM', 'GEICO', 'ALLSTATE', 'NATIONWIDE', 'NC FARM BUREAU', 'USAA', 'LIBERTY MUTUAL'];
const LIMITS = ['State Minimum Limits', '50/100', '100/300', '250/500'];
const LENGTHS = ['Less than 6 months', 'At least 6 months but less than 1 year', 'At least 1 year but less than 3 years', '3 years or more'];

export function emptyReports(requestId = 0): SimulatedReports {
  return { orderClue: true, orderMvr: false, clueStatus: 'not-ordered', mvrStatus: 'not-ordered', clueFindings: [], mvrFindings: [], vendor: null, priorSource: '', scoreTier: 1, orderedAt: '', staleReason: '', requestId };
}

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return Math.abs(value);
}

function customerKey(quote: QuoteData): string {
  const { insured } = quote;
  return `${insured.firstName}|${insured.lastName}|${insured.dob}|${insured.address.zip}`.toLowerCase();
}

export function vendorHistoryFor(quote: QuoteData): VendorHistory {
  const h = hash(customerKey(quote));
  const bucket = h % 10;
  const liabilityStatus: VendorHistory['liabilityStatus'] = bucket < 5 ? 'Yes, currently insured' : bucket < 8 ? 'Yes, not currently insured' : 'No';
  if (liabilityStatus === 'No') return { liabilityStatus, carrier: 'NO PRIOR CARRIER FOUND', biLimits: '—', length: '—' };
  return { liabilityStatus, carrier: CARRIERS[(h >> 4) % CARRIERS.length], biLimits: LIMITS[(h >> 8) % LIMITS.length], length: LENGTHS[(h >> 12) % LENGTHS.length] };
}

export function scoreTierFor(quote: QuoteData): number {
  return hash(`score|${customerKey(quote)}|${quote.drivers[0]?.ssn ?? ''}`) % 4;
}

/** Vendor answer to "liability coverage for past 6 months with no more than a 31-day lapse". */
export function vendorAnswer(vendor: VendorHistory): 'Yes' | 'No' {
  return vendor.liabilityStatus === 'No' ? 'No' : 'Yes';
}

export function vendorDiffers(vendor: VendorHistory, quote: QuoteData): boolean {
  return vendorAnswer(vendor) !== quote.additional.continuousInsurance;
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
