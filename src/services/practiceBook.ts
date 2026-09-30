// Five fictitious practice customers for the pending cancel / renewal, Customer Summary and ID card
// workflows. Every name, address, phone number, email and VIN is invented. Each account is issued
// in the past and run forward on the training clock, so its bills, notices and renewals are real.
import type { AgentProfile, BillPlan, QuoteData } from '@/types/quote';
import type { PolicyRecord } from '@/types/policy';
import { createSampleQuote, generateQuoteNumber } from '@/context/quoteStore';
import { createProductQuote } from '@/products/engine';
import { buildPolicies, generatePolicyNumber } from '@/services/policyBuilder';
import { advancePolicy, requestCancel, shiftDate, NC_OTHER_NOTICE_DAYS } from '@/services/policyEngine';
import { lookupVehicleDetails } from '@/data/vehicleCatalog';
import { rateQuote, ratingSignature } from '@/utils/ratingEngine';
import { setClock } from '@/utils/clock';
import { addMonths, parseDate } from '@/utils/dates';

/** Practice accounts are recognised by this email domain (so they are loaded only once). */
export const PRACTICE_DOMAIN = '@practice.example.com';

interface PracticeCustomer {
  first: string; last: string; dob: string; street: string; city: string; zip: string; phone: string;
  vehicle: [year: string, make: string, model: string, body: string]; vin: string;
  producer: string;
  /** Days before today the policy started (a function so renewals can land on the offer window). */
  startedDaysAgo: (day: string) => number;
  autoPlan: BillPlan;
  renters?: BillPlan;
  scenario: 'nonpayment' | 'underwriting' | 'renewal' | 'active';
}

const daysAgo = (days: number) => () => days;
/** A six-month auto term that expires in `days` (inside the 30-day renewal offer window). */
const expiringIn = (days: number) => (day: string) => {
  const today = parseDate(day)!;
  const start = addMonths(today, -6);
  return Math.round((today.getTime() - start.getTime()) / 86_400_000) - days;
};

const CUSTOMERS: PracticeCustomer[] = [
  { first: 'Jordan', last: 'Rivers', dob: '03/14/1988', street: '410 Maple Practice Ct', city: 'Raleigh', zip: '27609', phone: '919-555-0181', vehicle: ['2022', 'Honda', 'Accord', 'Sedan 4D'], vin: '1HGCV1F30NA000101', producer: 'Lane, Parker', startedDaysAgo: daysAgo(45), autoPlan: 'MAIL', scenario: 'nonpayment' },
  { first: 'Casey', last: 'Morgan', dob: '11/02/1993', street: '88 Willow Training Ln', city: 'Holly Springs', zip: '27540', phone: '919-555-0164', vehicle: ['2019', 'Toyota', 'RAV4', 'Utility 4D'], vin: '2T3F1RFV5KW000202', producer: 'Reyes, Dana', startedDaysAgo: daysAgo(44), autoPlan: 'EFT', renters: 'MAIL', scenario: 'nonpayment' },
  { first: 'Taylor', last: 'Brooks', dob: '07/21/1979', street: '1250 Sample Hwy 64 E', city: 'Mocksville', zip: '27028', phone: '704-555-0137', vehicle: ['2021', 'Ford', 'F-150', 'SuperCrew Pickup'], vin: '1FTFW1E84MK000303', producer: 'Quinn, Avery', startedDaysAgo: daysAgo(70), autoPlan: 'MAIL2', scenario: 'underwriting' },
  { first: 'Riley', last: 'Carter', dob: '01/30/1985', street: '298 Example Forest Dr', city: 'Hendersonville', zip: '28739', phone: '828-555-0152', vehicle: ['2023', 'Chevrolet', 'Silverado 1500', 'Crew Cab Pickup'], vin: '1GCUDDED0PZ000404', producer: 'Lane, Parker', startedDaysAgo: expiringIn(20), autoPlan: 'PIF', scenario: 'renewal' },
  { first: 'Morgan', last: 'Ellis', dob: '09/09/1990', street: '15 Harbor Demo St', city: 'Wilmington', zip: '28401', phone: '910-555-0119', vehicle: ['2020', 'Honda', 'CR-V', 'Utility 4D'], vin: '5J6RW2H50LA000505', producer: 'Reyes, Dana', startedDaysAgo: daysAgo(30), autoPlan: 'EFT', scenario: 'active' },
];

function quoteFor(customer: PracticeCustomer, agent: AgentProfile, effectiveDate: string): QuoteData {
  const base = createSampleQuote(agent);
  const [year, make, model, body] = customer.vehicle;
  const vehicle = { ...base.vehicles[0], year, make, model, bodyStyle: body, ...lookupVehicleDetails(year, make, model, body), vin: customer.vin, garagingZip: customer.zip };
  const email = `${customer.first}.${customer.last}${PRACTICE_DOMAIN}`.toLowerCase();
  const quote: QuoteData = {
    ...base,
    policy: { ...base.policy, effectiveDate },
    insured: { ...base.insured, firstName: customer.first, lastName: customer.last, dob: customer.dob, email, phones: [{ type: 'Cell', number: customer.phone }], address: { ...base.insured.address, line1: customer.street, city: customer.city, zip: customer.zip } },
    vehicles: [vehicle],
    drivers: [{ ...base.drivers[0], firstName: customer.first, lastName: customer.last, dob: customer.dob, licenseNumber: `0000${customer.vin.slice(-5)}`, primaryVehicleId: vehicle.id }],
    pointOfSale: { ...base.pointOfSale, billPlan: customer.autoPlan, paymentMethod: customer.autoPlan.startsWith('EFT') ? 'Bank account (EFT)' : 'Credit/debit card via secure IVR', documentDelivery: 'In person (print and sign)' },
    products: customer.renters ? ['auto', 'renters'] : ['auto'],
    productQuotes: {},
  };
  if (customer.renters) {
    const renters = createProductQuote('renters', generateQuoteNumber(), customer.zip);
    renters.units[0].values = { ...renters.units[0].values, sameAsMailing: 'Yes', garagingZip: customer.zip, dwelling: 'Apartment', units: '11 or more', yearBuilt: '2008', construction: 'Masonry', smoke: 'Yes', deadbolts: 'Yes', alarm: 'Local Alarm', sprinklers: 'Yes', hydrant: 'Yes' };
    renters.answers = { dogs: 'No', business: 'No', vacant: 'No', losses: '0' };
    renters.billPlan = customer.renters;
    quote.productQuotes = { renters };
  }
  return { ...quote, ratedSignature: ratingSignature(quote) };
}

/** Issues the practice accounts and runs them forward to `day` on the training clock. */
export function buildPracticeBook(agent: AgentProfile, agentCode: string, day: string): PolicyRecord[] {
  const records: PolicyRecord[] = [];
  try {
    for (const customer of CUSTOMERS) {
      const start = shiftDate(day, -customer.startedDaysAgo(day));
      setClock(parseDate(start));
      const quote = quoteFor(customer, agent, start);
      quote.policy.agentCode = agentCode;
      const issued = buildPolicies(quote, rateQuote(quote), true, customer.producer, start, { auto: generatePolicyNumber() });
      for (const record of issued) {
        let next = advancePolicy({ ...record, history: [...record.history, { id: `his-${record.id}`, date: start, event: 'Practice account', detail: 'Fictitious customer loaded for training.' }] }, start, day);
        if (customer.scenario === 'underwriting' && next.product === 'auto') {
          next = requestCancel(next, { kind: 'company', reason: 'Underwriting: an undisclosed household driver was found on the MVR and CLUE reports', effectiveDate: shiftDate(day, NC_OTHER_NOTICE_DAYS), method: 'Pro Rata' }, day);
        }
        records.push(next);
      }
    }
  } finally {
    setClock(parseDate(day));
  }
  return records;
}

export function hasPracticeBook(policies: PolicyRecord[]): boolean {
  return policies.some((policy) => policy.insured.email.endsWith(PRACTICE_DOMAIN));
}


