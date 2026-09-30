// Simulated MVR (Motor Vehicle Report) and CLUE (claims history) ordering.
// Findings are derived from what the VA entered, so disclosed incidents come back "flagged".
import type { Driver, SimulatedReports } from '@/types/quote';
import { INCIDENT_CODES } from '@/data/options';
import { driverName, ratedDrivers } from '@/utils/ratingEngine';
import { formatDate } from '@/utils/dates';

export const REPORT_DELAY_MS = 2000;

export function emptyReports(requestId = 0): SimulatedReports {
  return { mvrStatus: 'pending', clueStatus: 'pending', verificationDate: '', mvrFindings: [], clueFindings: [], staleReason: '', requestId };
}

export function buildReports(drivers: Driver[], requestId: number): SimulatedReports {
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

  return {
    mvrStatus: mvrFindings.length ? 'flagged' : 'cleared',
    clueStatus: clueFindings.length ? 'flagged' : 'cleared',
    verificationDate: formatDate(new Date()),
    mvrFindings,
    clueFindings,
    staleReason: '',
    requestId,
  };
}

/** Resolves after a realistic vendor delay with the simulated report results. */
export function simulateReports(drivers: Driver[], requestId: number): Promise<SimulatedReports> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(buildReports(drivers, requestId)), REPORT_DELAY_MS);
  });
}
