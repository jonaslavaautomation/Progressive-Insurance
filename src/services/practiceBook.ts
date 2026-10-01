// The agency's reference book of business: five fictitious customers, one in each of the states
// where Progressive holds the largest auto share (TX, FL, WI, OR, NH). Every name, address, phone
// number, email and VIN is invented. Each account is issued years ago and lived forward day by day
// on the policy engine (bills, on-time payments, renewals, a late payment, claims, policy changes),
// so its history, documents and current status are what a real account would show.
import type { AgentProfile, BillPlan, QuoteData } from '@/types/quote';
import type { ClaimRecord, PolicyRecord } from '@/types/policy';
import type { ProductKey } from '@/products/types';
import { createSampleQuote, generateQuoteNumber } from '@/context/quoteStore';
import { createProductQuote } from '@/products/engine';
import { buildPolicies, generatePolicyNumber } from '@/services/policyBuilder';
import { dayDiff, makePayment, otherNoticeDays, processDay, requestCancel, shiftDate } from '@/services/policyEngine';
import { lookupVehicleDetails } from '@/data/vehicleCatalog';
import { rateQuote, ratingSignature } from '@/utils/ratingEngine';
import { setClock } from '@/utils/clock';
import type { StateName } from '@/data/states';
import { addMonths, formatDate, parseDate } from '@/utils/dates';

/** Reference accounts are recognised by this email domain. */
export const PRACTICE_DOMAIN = '@practice.example.com';

interface AccountEvent {
  /** Days before today (negative numbers are not used). */
  daysAgo: number;
  product?: ProductKey;
  apply: (policy: PolicyRecord, day: string) => PolicyRecord;
}

interface PracticeCustomer {
  state: StateName;
  first: string; last: string; dob: string; street: string; city: string; zip: string; phone: string;
  vehicle: [year: string, make: string, model: string, body: string]; vin: string;
  producer: string;
  /** Where today falls in the current auto term: days since it started. */
  currentTermDaysAgo: (day: string) => number;
  /** Completed six-month auto terms before the current one (sets "customer since"). */
  priorTerms: number;
  autoPlan: BillPlan;
  renters?: BillPlan;
  scenario: 'nonpayment' | 'underwriting' | 'renewal' | 'active';
  /** Products whose current-term bills go unpaid (nonpayment scenario). */
  unpaid?: ProductKey[];
  /** An installment due in this month (MM/YYYY) is paid five days late. */
  lateMonth?: string;
  events?: AccountEvent[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const fixed = (days: number) => () => days;
/** A six-month auto term that expires in `days` (inside the 30-day renewal offer window). */
const expiringIn = (days: number) => (day: string) => dayDiff(formatDate(addMonths(parseDate(day)!, -6)), day) - days;

function note(event: string, detail: string, extra?: (policy: PolicyRecord, day: string) => PolicyRecord): AccountEvent['apply'] {
  return (policy, day) => {
    const next = extra ? extra(policy, day) : policy;
    return { ...next, history: [...next.history, { id: uid('his'), date: day, event, detail }] };
  };
}

function claim(input: Omit<ClaimRecord, 'id' | 'lossDate' | 'reportedOn' | 'claimNumber'> & { lossDaysBefore?: number }): AccountEvent['apply'] {
  return (policy, day) => {
    const lossDate = shiftDate(day, -(input.lossDaysBefore ?? 1));
    const record: ClaimRecord = { id: uid('clm'), claimNumber: `${day.slice(8)}-${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`, lossDate, reportedOn: day, type: input.type, description: input.description, status: input.status, paid: input.paid, adjuster: input.adjuster, atFault: input.atFault, unit: input.unit };
    const closed = input.status.startsWith('Closed');
    return { ...policy, claims: [...(policy.claims ?? []), record], history: [...policy.history, { id: uid('his'), date: day, event: 'Claim reported', detail: `Claim #${record.claimNumber}: ${input.type} on ${lossDate}. ${closed ? `${input.status}${input.paid ? `, $${input.paid.toFixed(2)} paid` : ''}.` : `Assigned to ${input.adjuster}.`}` }] };
  };
}

const CUSTOMERS: PracticeCustomer[] = [
  {
    state: 'Texas', first: 'Jordan', last: 'Rivers', dob: '03/14/1988', street: '410 Maple Practice Ct', city: 'Austin', zip: '78745', phone: '512-555-0181', vehicle: ['2022', 'Honda', 'Accord', 'Sedan 4D'], vin: '1HGCV1F30NA000101',
    producer: 'Lane, Parker', currentTermDaysAgo: fixed(45), priorTerms: 8, autoPlan: 'MAIL', scenario: 'nonpayment', unpaid: ['auto'], lateMonth: '03/2024',
    events: [{ daysAgo: 800, apply: note('Policy change processed', 'Mailing address updated from 22 Oak Sample St, Austin 78702 to 410 Maple Practice Ct, Austin 78745. Garaging territory re-rated. No premium change.') }],
  },
  {
    state: 'Florida', first: 'Casey', last: 'Morgan', dob: '11/02/1993', street: '88 Willow Training Ln', city: 'Tampa', zip: '33606', phone: '813-555-0164', vehicle: ['2019', 'Toyota', 'RAV4', 'Utility 4D'], vin: '2T3F1RFV5KW000202',
    producer: 'Reyes, Dana', currentTermDaysAgo: fixed(44), priorTerms: 14, autoPlan: 'EFT', renters: 'MAIL', scenario: 'nonpayment', unpaid: ['renters'],
    events: [
      { daysAgo: 1510, product: 'renters', apply: claim({ type: 'Theft - personal property', description: 'Laptop and bicycle stolen from the apartment storage unit. Police report filed.', status: 'Closed - Paid', paid: 1250, adjuster: 'Property Claims Team 4', atFault: 'No', unit: 'Apartment', lossDaysBefore: 2 }) },
      { daysAgo: 400, product: 'auto', apply: note('Policy change processed', 'Email address and paperless document preference updated. No premium change.') },
    ],
  },
  {
    state: 'Wisconsin', first: 'Taylor', last: 'Brooks', dob: '07/21/1979', street: '1250 Sample Hwy 151', city: 'Madison', zip: '53704', phone: '608-555-0137', vehicle: ['2021', 'Ford', 'F-150', 'SuperCrew Pickup'], vin: '1FTFW1E84MK000303',
    producer: 'Quinn, Avery', currentTermDaysAgo: fixed(70), priorTerms: 10, autoPlan: 'MAIL2', scenario: 'underwriting',
    events: [{ daysAgo: 1010, apply: claim({ type: 'Collision - at fault', description: 'Insured rear-ended another vehicle at a stop light on US-151. No injuries. Both vehicles repaired.', status: 'Closed - Paid', paid: 4812.4, adjuster: 'Auto Claims Team 12', atFault: 'Yes', unit: '2021 Ford F-150', lossDaysBefore: 1 }) }],
  },
  {
    state: 'Oregon', first: 'Riley', last: 'Carter', dob: '01/30/1985', street: '298 Example Forest Dr', city: 'Portland', zip: '97206', phone: '503-555-0152', vehicle: ['2023', 'Chevrolet', 'Silverado 1500', 'Crew Cab Pickup'], vin: '1GCUDDED0PZ000404',
    producer: 'Lane, Parker', currentTermDaysAgo: expiringIn(20), priorTerms: 6, autoPlan: 'PIF', scenario: 'renewal',
    events: [{ daysAgo: 620, apply: claim({ type: 'Comprehensive - glass', description: 'Windshield cracked by a rock on I-84. Replaced by a network glass shop.', status: 'Closed - Paid', paid: 385, adjuster: 'Glass Claims Unit', atFault: 'No', unit: '2023 Chevrolet Silverado 1500', lossDaysBefore: 0 }) }],
  },
  {
    state: 'New Hampshire', first: 'Morgan', last: 'Ellis', dob: '09/09/1990', street: '15 Harbor Demo St', city: 'Manchester', zip: '03104', phone: '603-555-0119', vehicle: ['2020', 'Honda', 'CR-V', 'Utility 4D'], vin: '5J6RW2H50LA000505',
    producer: 'Reyes, Dana', currentTermDaysAgo: fixed(30), priorTerms: 12, autoPlan: 'EFT', scenario: 'active',
    events: [
      { daysAgo: 1150, apply: note('Policy change processed', 'Replaced 2016 Honda Civic (VIN 19XFC2F59GE000999) with 2020 Honda CR-V (VIN 5J6RW2H50LA000505). Lienholder removed. Additional premium $38.20.') },
      { daysAgo: 9, apply: claim({ type: 'Comprehensive - animal strike', description: 'Struck a deer on NH-101 at night. Front bumper and headlight damage. Vehicle drivable.', status: 'Open - Assigned', paid: 0, adjuster: 'Auto Claims Team 7', atFault: 'No', unit: '2020 Honda CR-V', lossDaysBefore: 1 }) },
    ],
  },
];

function quoteFor(customer: PracticeCustomer, agent: AgentProfile, effectiveDate: string, agentCode: string): QuoteData {
  const base = createSampleQuote(agent, customer.state);
  const [year, make, model, body] = customer.vehicle;
  const vehicle = { ...base.vehicles[0], year, make, model, bodyStyle: body, ...lookupVehicleDetails(year, make, model, body), vin: customer.vin, garagingZip: customer.zip };
  const email = `${customer.first}.${customer.last}${PRACTICE_DOMAIN}`.toLowerCase();
  const quote: QuoteData = {
    ...base,
    policy: { ...base.policy, effectiveDate, agentCode },
    insured: { ...base.insured, firstName: customer.first, lastName: customer.last, dob: customer.dob, email, phones: [{ type: 'Cell', number: customer.phone }], address: { ...base.insured.address, line1: customer.street, city: customer.city, zip: customer.zip } },
    vehicles: [vehicle],
    drivers: [{ ...base.drivers[0], firstName: customer.first, lastName: customer.last, dob: customer.dob, licenseNumber: `0000${customer.vin.slice(-5)}`, primaryVehicleId: vehicle.id }],
    additional: { ...base.additional, continuousInsurance: customer.priorTerms > 8 ? 'Yes' : 'No' },
    pointOfSale: { ...base.pointOfSale, billPlan: customer.autoPlan, paymentMethod: customer.autoPlan.startsWith('EFT') ? 'Bank account (EFT)' : 'Credit/debit card via secure IVR', documentDelivery: 'In person (print and sign)' },
    products: customer.renters ? ['auto', 'renters'] : ['auto'],
    productQuotes: {},
  };
  if (customer.renters) {
    const renters = createProductQuote('renters', generateQuoteNumber(), customer.zip);
    renters.units[0].values = { ...renters.units[0].values, sameAsMailing: 'Yes', garagingZip: customer.zip, dwelling: 'Apartment', dogBreed: 'No', verifiedNone: 'Yes', personalProperty: '20000' };
    renters.answers = { priorInsurer: 'State Farm', priorLiability: '$300,000', claims: '0 Claims', esign: 'Yes', packagePolicy: 'LAVA Auto 100/300', securedSubdivision: 'No', paperless: 'Yes' };
    renters.billPlan = customer.renters;
    quote.productQuotes = { renters };
  }
  return { ...quote, ratedSignature: ratingSignature(quote) };
}

/** Lives a policy forward from `start` to `day`: the customer pays on time unless told otherwise. */
function live(policy: PolicyRecord, customer: PracticeCustomer, start: string, day: string, stopPayingFrom: string, events: AccountEvent[]): PolicyRecord {
  let next = policy;
  const unpaid = customer.unpaid?.includes(policy.product as ProductKey) ?? false;
  const skipRenewal = customer.scenario === 'renewal';
  for (let today = shiftDate(start, 1); dayDiff(today, day) >= 0; today = shiftDate(today, 1)) {
    next = processDay(next, today);
    for (const event of events) if (shiftDate(day, -event.daysAgo) === today && (!event.product || event.product === policy.product)) next = event.apply(next, today);
    if (next.status !== 'Active' && next.status !== 'Pending Cancel') continue;
    const paying = !(unpaid && dayDiff(stopPayingFrom, today) >= 0);
    if (!next.autopay && paying) {
      const late = (due: string) => customer.lateMonth === `${due.slice(0, 2)}/${due.slice(6)}`;
      const due = next.installments.filter((entry) => (entry.status === 'billed' || entry.status === 'past due') && dayDiff(entry.due, today) === (late(entry.due) ? 5 : 0));
      const amount = round2(due.reduce((sum, entry) => sum + entry.amount - entry.paid, 0) + (due.length ? next.feesDue : 0));
      if (amount > 0.005) next = makePayment(next, amount, next.paymentMethod || 'Credit/debit card via secure IVR', today);
    }
    const renewal = next.renewal;
    // The renewal-scenario customer has not paid the offer that is open today.
    const lastOffer = skipRenewal && !!renewal && dayDiff(day, renewal.effectiveDate) > 0;
    if (renewal?.status === 'Offered' && dayDiff(renewal.offeredOn, today) === 3 && !lastOffer) next = makePayment(next, renewal.dueToday, next.paymentMethod || 'Credit/debit card via secure IVR', today);
  }
  return next;
}

/** Issues the reference accounts and lives them forward to `day`. */
export function buildPracticeBook(agent: AgentProfile, agentCode: string, day: string): PolicyRecord[] {
  const records: PolicyRecord[] = [];
  try {
    for (const customer of CUSTOMERS) {
      const currentStart = shiftDate(day, -customer.currentTermDaysAgo(day));
      const start = formatDate(addMonths(parseDate(currentStart)!, -6 * customer.priorTerms));
      setClock(parseDate(start));
      const quote = quoteFor(customer, agent, start, agentCode);
      const issued = buildPolicies(quote, rateQuote(quote), true, customer.producer, start, { auto: generatePolicyNumber() });
      for (const record of issued) {
        const opened = { ...record, claims: [], history: [...record.history, { id: uid('his'), date: start, event: 'Reference account', detail: 'Fictitious customer included in the agency book for reference and practice.' }] };
        let next = live(opened, customer, start, day, currentStart, customer.events ?? []);
        if (customer.scenario === 'underwriting' && next.product === 'auto') {
          next = requestCancel(next, { kind: 'company', reason: 'Underwriting: an undisclosed household driver was found on the MVR and CLUE reports', effectiveDate: shiftDate(day, Math.max(otherNoticeDays(next), 30)), method: 'Pro Rata' }, day);
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
