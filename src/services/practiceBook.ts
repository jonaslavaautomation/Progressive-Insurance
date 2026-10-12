// The agency's reference book of business: fictitious personal customers (including the Whitfield
// household with two auto policies, HO3, HO4, HO6 and a landlord policy) and a commercial account
// (Commercial Auto, Trucking and Commercial Property), one in each of the states
// where Progressive holds the largest auto share (TX, FL, WI, OR, NH). Every name, address, phone
// number, email and VIN is invented. Each account is issued years ago and lived forward day by day
// on the policy engine (bills, on-time payments, renewals, a late payment, claims, policy changes),
// so its history, documents and current status are what a real account would show.
import type { AgentProfile, BillPlan, QuoteData } from '@/types/quote';
import type { ClaimRecord, PolicyRecord } from '@/types/policy';
import type { CommercialKey, ProductKey, ProductQuote } from '@/products/types';
import type { CommercialDriver } from '@/commercial/types';
import { createCommercialQuote, recalculateCommercial } from '@/commercial/engine';
import { buildCommercialPolicies } from '@/services/policyBuilder';
import { createDriver, createSampleQuote, generateQuoteNumber } from '@/context/quoteStore';
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
/** Bumped when the reference accounts change, so saved books rebuild them. */
export const PRACTICE_VERSION = 8;

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
  /** A Homeowners (HO3) policy on the mailing address, with a first mortgagee. */
  home?: { yearBuilt: string; squareFeet: string; dwellingValue: string; roofYear: string; mortgagee: string; mortgageeAddress: string; loanNumber: string; escrow: boolean };
  /** A Condo Unit Owners (HO6) policy on a second home. */
  condo?: { street: string; city: string; zip: string; unitNumber: string; yearBuilt: string; unitValue: string; personalProperty: string; occupancy: string; mortgagee?: Mortgagee };
  /** A Landlord (DP-3) policy on a rental property. */
  landlord?: { street: string; city: string; zip: string; families: string; yearBuilt: string; squareFeet: string; roofYear: string; dwellingValue: string; mortgagee?: Mortgagee };
  scenario: 'nonpayment' | 'underwriting' | 'renewal' | 'active';
  /** Products whose current-term bills go unpaid (nonpayment scenario). */
  unpaid?: ProductKey[];
  /** An installment due in this month (MM/YYYY) is paid five days late. */
  lateMonth?: string;
  events?: AccountEvent[];
  /** A household: spouse on the auto policy with a second vehicle, and the spouse's own motorcycle policy. */
  household?: {
    spouse: { first: string; dob: string };
    vehicle: [year: string, make: string, model: string, body: string]; vin: string;
    motorcycle?: { year: string; make: string; model: string; type: string; cc: string; value: string; vin: string; startDaysAgo: number; cancelDaysAgo: number };
  };
}

interface Mortgagee { name: string; address: string; loanNumber: string }

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
  // The Whitfield household (North Carolina): Avery holds Auto #1 (with spouse Robin), the home (HO3),
  // a beach condo (HO6) and a duplex rental (Landlord); son Parker, at college, holds Auto #2 and Renters.
  {
    state: 'North Carolina', first: 'Avery', last: 'Whitfield', dob: '06/14/1977', street: '2240 Sample Oak Dr', city: 'Raleigh', zip: '27606', phone: '919-555-0173', vehicle: ['2021', 'Ford', 'F-150', 'SuperCrew Pickup'], vin: '1FTFW1E52MF000808',
    producer: 'Lane, Parker', currentTermDaysAgo: fixed(60), priorTerms: 10, autoPlan: 'EFT', scenario: 'active',
    household: { spouse: { first: 'Robin', dob: '02/03/1979' }, vehicle: ['2022', 'Honda', 'Accord', 'Sedan 4D'], vin: '1HGCV1F14NA000909' },
    home: { yearBuilt: '2008', squareFeet: '2600', dwellingValue: '480000', roofYear: '2019', mortgagee: 'Triangle Sample Bank, ISAOA/ATIMA', mortgageeAddress: 'PO Box 3300, Raleigh, NC 27602', loanNumber: 'TSB-7720115', escrow: true },
    condo: { street: '15 Practice Dunes Way', city: 'Wilmington', zip: '28403', unitNumber: '4B', yearBuilt: '2001', unitValue: '60000', personalProperty: '40000', occupancy: 'Owner occupied (secondary/seasonal)', mortgagee: { name: 'Coastal Sample Credit Union, ISAOA', address: '800 Harbor Example Rd, Wilmington, NC 28401', loanNumber: 'CSC-301442' } },
    landlord: { street: '612 Example Mill St', city: 'Durham', zip: '27701', families: '2 (duplex)', yearBuilt: '1994', squareFeet: '2100', roofYear: '2015', dwellingValue: '285000' },
    events: [{ daysAgo: 500, product: 'auto', apply: note('Policy change processed', 'Added 2022 Honda Accord for Robin Whitfield. Additional premium $212.40.') }],
  },
  {
    state: 'North Carolina', first: 'Parker', last: 'Whitfield', dob: '09/22/2004', street: '1180 Campus Sample Ave Apt 3C', city: 'Greensboro', zip: '27403', phone: '336-555-0148', vehicle: ['2018', 'Honda', 'Civic', 'Sedan 4D'], vin: '19XFC2F56JE001010',
    producer: 'Lane, Parker', currentTermDaysAgo: fixed(25), priorTerms: 3, autoPlan: 'CARD', renters: 'MAIL', scenario: 'active',
  },
  {
    state: 'Texas', first: 'Jordan', last: 'Rivers', dob: '03/14/1988', street: '410 Maple Practice Ct', city: 'Austin', zip: '78745', phone: '512-555-0181', vehicle: ['2022', 'Honda', 'Accord', 'Sedan 4D'], vin: '1HGCV1F30NA000101',
    producer: 'Lane, Parker', currentTermDaysAgo: fixed(45), priorTerms: 8, autoPlan: 'MAIL', scenario: 'nonpayment', unpaid: ['auto'], lateMonth: '03/2024',
    events: [{ daysAgo: 800, apply: note('Policy change processed', 'Mailing address updated from 22 Oak Sample St, Austin 78702 to 410 Maple Practice Ct, Austin 78745. Garaging territory re-rated. No premium change.') }],
  },
  {
    state: 'Florida', first: 'Casey', last: 'Morgan', dob: '11/02/1993', street: '88 Willow Training Ln', city: 'Tampa', zip: '33606', phone: '813-555-0164', vehicle: ['2019', 'Toyota', 'RAV4', 'Utility 4D'], vin: '2T3F1RFV5KW000202',
    producer: 'Reyes, Dana', currentTermDaysAgo: fixed(44), priorTerms: 14, autoPlan: 'CARD', renters: 'MAIL', scenario: 'nonpayment', unpaid: ['renters'],
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
    home: { yearBuilt: '2004', squareFeet: '1850', dwellingValue: '365000', roofYear: '2018', mortgagee: 'Granite Sample Mortgage Co., ISAOA/ATIMA', mortgageeAddress: 'PO Box 4400, Concord, NH 03302', loanNumber: 'GSM-4471209', escrow: true },
    household: {
      spouse: { first: 'Jamie', dob: '05/17/1991' },
      vehicle: ['2017', 'Hyundai', 'Tucson', 'Utility 4D'], vin: 'KM8J3CA46HU000606',
      motorcycle: { year: '2019', make: 'Honda', model: 'Rebel 500', type: 'Cruiser', cc: '471', value: '5200', vin: 'JH2PC4500KK000707', startDaysAgo: 700, cancelDaysAgo: 330 },
    },
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
  const household = customer.household;
  const vehicles = [vehicle];
  const drivers = [{ ...base.drivers[0], firstName: customer.first, lastName: customer.last, dob: customer.dob, licenseNumber: `0000${customer.vin.slice(-5)}`, primaryVehicleId: vehicle.id, ...(household ? { maritalStatus: 'Married' } : {}) }];
  if (household) {
    const [year2, make2, model2, body2] = household.vehicle;
    const second = { ...vehicle, id: uid('veh'), year: year2, make: make2, model: model2, bodyStyle: body2, ...lookupVehicleDetails(year2, make2, model2, body2), vin: household.vin };
    vehicles.push(second);
    drivers.push(createDriver({ ...base.drivers[0], id: uid('drv'), firstName: household.spouse.first, lastName: customer.last, dob: household.spouse.dob, relationship: 'Spouse', maritalStatus: 'Married', licenseNumber: `0000${household.vin.slice(-5)}`, primaryVehicleId: second.id }));
  }
  const quote: QuoteData = {
    ...base,
    policy: { ...base.policy, effectiveDate, agentCode },
    insured: { ...base.insured, firstName: customer.first, lastName: customer.last, dob: customer.dob, email, phones: [{ type: 'Cell', number: customer.phone }], address: { ...base.insured.address, line1: customer.street, city: customer.city, zip: customer.zip } },
    vehicles,
    drivers,
    additional: customer.priorTerms > 8
      ? { ...base.additional, continuousInsurance: 'Yes', priorCarrier: 'Other standard carrier', priorLimits: '100/300', priorYears: '3 years or more' }
      : { ...base.additional, continuousInsurance: 'No', priorCarrier: '', priorLimits: '', priorYears: '' },
    pointOfSale: { ...base.pointOfSale, billPlan: customer.autoPlan, paymentMethod: customer.autoPlan.startsWith('EFT') ? 'Bank account (EFT)' : 'Credit/debit card via secure IVR', documentDelivery: 'In person (print and sign)' },
    products: ['auto', ...(customer.renters ? ['renters' as const] : []), ...(customer.home ? ['homeowners' as const] : []), ...(customer.condo ? ['condo' as const] : []), ...(customer.landlord ? ['landlord' as const] : [])],
    productQuotes: {},
  };
  if (customer.renters) {
    const renters = createProductQuote('renters', generateQuoteNumber(), customer.zip);
    renters.units[0].values = { ...renters.units[0].values, sameAsMailing: 'Yes', garagingZip: customer.zip, dwelling: 'Apartment', dogBreed: 'No', verifiedNone: 'Yes', personalProperty: '20000' };
    renters.answers = { priorInsurer: 'State Farm', priorLiability: '$300,000', claims: '0 Claims', esign: 'Yes', packagePolicy: 'LAVA Auto 100/300', securedSubdivision: 'No', paperless: 'Yes' };
    renters.billPlan = customer.renters;
    quote.productQuotes = { ...quote.productQuotes, renters };
  }
  if (customer.home) {
    const home = customer.home;
    const homeowners = createProductQuote('homeowners', generateQuoteNumber(), customer.zip);
    homeowners.units[0].values = { ...homeowners.units[0].values, sameAsMailing: 'Yes', garagingZip: customer.zip, yearBuilt: home.yearBuilt, squareFeet: home.squareFeet, construction: 'Frame', stories: '2', roofType: 'Architectural Shingle', roofYear: home.roofYear, protection: 'Protected (hydrant within 1,000 ft, fire station within 5 miles)', alarm: 'Yes', dwellingValue: home.dwellingValue };
    homeowners.answers = { priorInsurer: 'Other', claims: '0 Claims', occupancy: 'No', hazards: 'No', mortgageeBilled: home.escrow ? 'Yes' : 'No' };
    homeowners.interests = [{ id: uid('mg'), name: home.mortgagee, address: home.mortgageeAddress, loanNumber: home.loanNumber, position: 'First' }];
    homeowners.billPlan = 'PIF';
    quote.productQuotes = { ...quote.productQuotes, homeowners };
    quote.additional = { ...quote.additional, primaryResidence: 'Single Family Home' };
  }
  const mortgagees = (mortgagee?: Mortgagee): ProductQuote['interests'] => (mortgagee ? [{ id: uid('mg'), name: mortgagee.name, address: mortgagee.address, loanNumber: mortgagee.loanNumber, position: 'First' }] : []);
  if (customer.condo) {
    const unit = customer.condo;
    const condo = createProductQuote('condo', generateQuoteNumber(), unit.zip);
    condo.units[0].values = { ...condo.units[0].values, sameAsMailing: 'No', street: unit.street, city: unit.city, garagingZip: unit.zip, unitNumber: unit.unitNumber, yearBuilt: unit.yearBuilt, construction: 'Masonry', floor: '2nd - 4th floor', occupancy: unit.occupancy, sprinklered: 'Yes', unitValue: unit.unitValue, personalProperty: unit.personalProperty };
    condo.answers = { priorInsurer: 'Other', claims: '0 Claims', masterPolicy: 'Yes', mortgageeBilled: 'No' };
    condo.interests = mortgagees(unit.mortgagee);
    condo.billPlan = 'PIF';
    quote.productQuotes = { ...quote.productQuotes, condo };
  }
  if (customer.landlord) {
    const rental = customer.landlord;
    const landlord = createProductQuote('landlord', generateQuoteNumber(), rental.zip);
    landlord.units[0].values = { ...landlord.units[0].values, sameAsMailing: 'No', street: rental.street, city: rental.city, garagingZip: rental.zip, families: rental.families, yearBuilt: rental.yearBuilt, squareFeet: rental.squareFeet, construction: 'Frame', roofType: 'Asphalt Shingle', roofYear: rental.roofYear, protection: 'Protected (hydrant within 1,000 ft, fire station within 5 miles)', lease: 'Annual lease (12 months or longer)', dwellingValue: rental.dwellingValue };
    landlord.answers = { priorInsurer: 'Other', claims: '0 Claims', vacant: 'No', tenantsScreened: 'Yes', mortgageeBilled: 'No' };
    landlord.interests = mortgagees(rental.mortgagee);
    landlord.billPlan = 'EFT';
    quote.productQuotes = { ...quote.productQuotes, landlord };
  }
  return { ...quote, ratedSignature: ratingSignature(quote) };
}

/** The spouse's own motorcycle policy at the same address (household account). */
function motorcycleQuoteFor(customer: PracticeCustomer, agent: AgentProfile, effectiveDate: string, agentCode: string): QuoteData {
  const household = customer.household!;
  const bike = household.motorcycle!;
  const base = quoteFor({ ...customer, household: undefined }, agent, effectiveDate, agentCode);
  const first = household.spouse.first;
  const motorcycle = createProductQuote('motorcycle', generateQuoteNumber(), customer.zip);
  motorcycle.units[0].values = { ...motorcycle.units[0].values, type: bike.type, vin: bike.vin, year: bike.year, make: bike.make, model: bike.model, cc: bike.cc, value: bike.value, garagingZip: customer.zip, miles: '2,000 - 4,999', antiTheft: 'No' };
  motorcycle.answers = { racing: 'No', safetyCourse: 'Yes' };
  motorcycle.billPlan = 'PIF';
  const quote: QuoteData = {
    ...base,
    insured: { ...base.insured, firstName: first, dob: household.spouse.dob, email: `${first}.${customer.last}${PRACTICE_DOMAIN}`.toLowerCase() },
    drivers: [{ ...base.drivers[0], firstName: first, dob: household.spouse.dob, maritalStatus: 'Married', licenseNumber: `0000${bike.vin.slice(-5)}` }],
    pointOfSale: { ...base.pointOfSale, billPlan: 'PIF', paymentMethod: 'Credit/debit card via secure IVR' },
    products: ['motorcycle'],
    productQuotes: { motorcycle },
  };
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

// ------------------------------------------------------------------ Commercial account

const BUSINESS = {
  name: 'Sample Ridge Logistics LLC', dba: '', entity: 'Limited Liability Company (LLC)', fein: '000000000', industry: 'Courier/Local Delivery', operations: 'Local delivery, regional dry-van freight (for-hire, own MC authority) and a warehouse/distribution building',
  yearsInBusiness: 'More than 5 years', street: '4100 Example Commerce Blvd', city: 'Charlotte', state: 'North Carolina', zip: '28208', contact: 'Morgan Example', contactTitle: 'Owner', phone: '704-555-0191', email: `dispatch.sampleridge${PRACTICE_DOMAIN}`,
  revenue: '3200000', employees: '18', payroll: '1100000',
};

function commercialDriver(first: string, last: string, dob: string, licenseType: string, experience: string, role: string, hireDate: string): CommercialDriver {
  return { id: uid('cdr'), firstName: first, lastName: last, dob, licenseState: 'North Carolina', licenseNumber: `000${dob.slice(-4)}${first.length}`, licenseType, experience, violations: '0', accidents: '0', role, hireDate };
}

/** Sample Ridge Logistics: Commercial Auto (service fleet), Trucking (for-hire) and Commercial Property (warehouse). */
function commercialPracticeQuote(effectiveDate: string) {
  const keys: CommercialKey[] = ['commercialAuto', 'trucking', 'property'];
  const quote = createCommercialQuote(keys);
  const unit = (key: CommercialKey, values: Record<string, string>, coverages: Record<string, string> = {}) => ({ id: uid('unit'), values, coverages });
  const product = (key: CommercialKey, patch: Partial<ProductQuote>) => ({ ...quote.productQuotes[key]!, ...patch, coverages: { ...quote.productQuotes[key]!.coverages, ...(patch.coverages ?? {}) } });
  return recalculateCommercial({
    ...quote,
    business: { ...quote.business, ...BUSINESS },
    drivers: [commercialDriver('Morgan', 'Example', '03/11/1975', 'CDL - Class A', 'More than 5 years', 'Owner / Officer', '03/01/2015'), commercialDriver('Taylor', 'Sample', '07/29/1983', 'CDL - Class A', 'More than 5 years', 'Employee', '06/15/2018'), commercialDriver('Jesse', 'Practice', '12/02/1990', 'Standard (Class C)', '2 to 5 years', 'Employee', '09/01/2021')],
    answers: {
      priorCoverage: 'Yes', priorCarrier: 'Sample Mutual Insurance Co.', priorPremium: '24000', losses: '0', cancelled: 'No', bankruptcy: 'No',
      subsidiaryOf: 'No', subsidiaries: 'No', safetyProgram: 'Yes', flammables: 'No', otherVentures: 'No', abuse: 'No', fraud: 'No', codeViolations: 'No', judgment: 'No', trust: 'No', foreign: 'No', drones: 'No',
    },
    effectiveDate,
    paymentMethod: 'Bank account (EFT)',
    paymentAuthorized: 'Yes',
    signedApplication: true,
    confirmedAccuracy: true,
    productQuotes: {
      commercialAuto: product('commercialAuto', {
        units: [
          unit('commercialAuto', { type: 'Pickup Truck', vin: '1FTEW1EP0NK001111', year: '2022', make: 'Ford', model: 'F-150', gvw: 'Light (10,000 lbs or less)', radius: 'Local (up to 50 miles)', use: 'Service (carries tools/equipment to job sites)', value: '42000', garagingZip: '28208' }, { comp: '1000', coll: '1000', rental: 'None', towing: 'Yes' }),
          unit('commercialAuto', { type: 'Box Truck', vin: '54DC4W1B7MS001212', year: '2021', make: 'Isuzu', model: 'NPR-HD', gvw: 'Medium (10,001 - 20,000 lbs)', radius: 'Local (up to 50 miles)', use: 'Retail (delivers to households)', value: '58000', garagingZip: '28208' }, { comp: '1000', coll: '1000', rental: '100', towing: 'Yes' }),
        ],
        coverages: { liability: '1000000', um: '300000', medpay: '5000', hnoa: 'Yes' },
        answers: { hazmat: 'No', interstate: 'No', mvrReview: 'Yes', notOwned: 'No', employeeAutos: 'No', maintenance: 'Yes', leasedToOthers: 'No', customized: 'No', familyUse: 'No', hiringStandard: 'Yes', noWorkComp: 'No', unscheduled: 'No', passengers: 'No', holdHarmless: 'No' },
        billPlan: 'EFT',
      }),
      trucking: product('trucking', {
        units: [
          unit('trucking', { type: 'Tractor (Semi)', vin: '1FUJHHDR2NLN01313', year: '2022', make: 'Freightliner', model: 'Cascadia', gvw: '33,001 - 80,000 lbs', radius: '101 - 300 miles (regional)', value: '135000', garagingZip: '28208' }, { comp: '2500', coll: '2500' }),
          unit('trucking', { type: 'Dry Van Trailer', vin: '1GRAA0621MB701414', year: '2021', make: 'Great Dane', model: 'Champion 53 ft', gvw: '33,001 - 80,000 lbs', radius: '101 - 300 miles (regional)', value: '38000', garagingZip: '28208' }, { comp: '1000', coll: '1000' }),
        ],
        coverages: { liability: '1000000', um: '300000', cargo: '100000', cargoDeductible: '2500', interchange: '30000' },
        answers: { authority: 'Own MC authority (for-hire)', operation: 'Interstate (crosses state lines)', usdot: '0000001', mc: '000001', commodity: 'General freight (dry van)', authorityYears: '3 years or more', eld: 'Yes', csaAlerts: 'No', safetyRating: 'Satisfactory', drugTesting: 'Yes', screening: 'Yes', turnover: '0 - 1', ownerOperators: 'No', broker: 'No', priorAuthority: 'No', area: 'East of the Rocky Mountains' },
        billPlan: 'EFT',
      }),
      property: product('property', {
        units: [unit('property', { street: '4100 Example Commerce Blvd', city: 'Charlotte', garagingZip: '28208', occupancy: 'Warehouse / storage', construction: 'Masonry Non-Combustible (ISO 4)', yearBuilt: '1999', squareFeet: '18000', stories: '1', interest: 'Owner', occupiedPct: '100%', roofType: 'Single-ply membrane (TPO/EPDM)', roofYear: '2016', wiringYear: '2012', plumbingYear: '2012', heatingYear: '2019', floodZone: 'X (minimal risk)', sprinklered: 'Yes', protectionClass: '2', alarm: 'Central Station Monitored', buildingValue: '1850000', bppValue: '320000', biLimit: '250000' })],
        coverages: { causes: 'Special', valuation: 'Replacement Cost', coinsurance: '90', deductible: '2500', windDeductible: 'Same', equipmentBreakdown: 'Yes' },
        answers: { vacancy: 'No', knobTube: 'No', otherTenants: 'No other tenants', cooking: 'No commercial cooking' },
        billPlan: 'PIF',
      }),
    },
  });
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
        records.push({ ...next, practiceVersion: PRACTICE_VERSION });
      }
      const bike = customer.household?.motorcycle;
      if (bike && customer.household) {
        const bikeStart = shiftDate(day, -bike.startDaysAgo);
        setClock(parseDate(bikeStart));
        const quote = motorcycleQuoteFor(customer, agent, bikeStart, agentCode);
        const cancel: AccountEvent = { daysAgo: bike.cancelDaysAgo, apply: (policy, today) => requestCancel(policy, { kind: 'insured', reason: 'Sold or disposed of the insured property/vehicle', effectiveDate: today, method: 'Pro Rata' }, today) };
        for (const record of buildPolicies(quote, rateQuote(quote), true, customer.producer, bikeStart, { motorcycle: generatePolicyNumber() })) {
          const opened = { ...record, claims: [], history: [...record.history, { id: uid('his'), date: bikeStart, event: 'Reference account', detail: 'Fictitious household member included in the agency book for reference and practice.' }] };
          records.push({ ...live(opened, { ...customer, scenario: 'active', unpaid: [] }, bikeStart, day, day, [cancel]), practiceVersion: PRACTICE_VERSION });
        }
      }
    }
    // The commercial account: issued four years ago, renewed each year, paid on time.
    const commercialStart = shiftDate(day, -(365 * 3 + 120));
    setClock(parseDate(commercialStart));
    const stub = { ...CUSTOMERS[CUSTOMERS.length - 1], scenario: 'active' as const, unpaid: [], lateMonth: undefined };
    for (const record of buildCommercialPolicies(commercialPracticeQuote(commercialStart), agentCode, 'Reyes, Dana', commercialStart)) {
      const opened = { ...record, claims: [], history: [...record.history, { id: uid('his'), date: commercialStart, event: 'Reference account', detail: 'Fictitious commercial customer included in the agency book for reference and practice.' }] };
      records.push({ ...live(opened, stub, commercialStart, day, day, []), practiceVersion: PRACTICE_VERSION });
    }
  } finally {
    setClock(parseDate(day));
  }
  return records;
}

export function isPracticePolicy(policy: PolicyRecord): boolean {
  return policy.insured.email.endsWith(PRACTICE_DOMAIN);
}

/** True when the book already holds the current version of the reference accounts. */
export function hasPracticeBook(policies: PolicyRecord[]): boolean {
  return policies.some((policy) => isPracticePolicy(policy) && policy.practiceVersion === PRACTICE_VERSION);
}
