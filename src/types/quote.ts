import type { OtherProductKey, ProductKey, ProductQuote } from '@/products/types';

// Core data model for the simulated auto quote. All values are strings as entered
// in the carrier UI (dates are MM/DD/YYYY) so they round-trip through form controls.

export type YesNo = '' | 'Yes' | 'No';

/** The logged-in agent for this browser session (never taken from reference data). */
export interface AgentProfile {
  name: string;
  agencyName: string;
  agencyCode: string;
}

export interface Phone {
  type: 'Cell' | 'Home' | 'Work';
  number: string;
}

export interface MailingAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  poBox: boolean;
}

export interface NamedInsured {
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix: string;
  dob: string;
  gender: string;
  email: string;
  phones: Phone[];
  address: MailingAddress;
  movedRecently: YesNo;
  disclosureAcknowledged: YesNo;
}

export interface Vehicle {
  id: string;
  vehicleType: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  bodyStyle: string;
  isoSymbol: string;
  isoSymbolOtc: string;
  isoSymbolCollision: string;
  garagingZip: string;
  ownershipLength: string;
  primaryUse: string;
  rideshare: YesNo;
  delivery: YesNo;
  marketValue: string;
  originalCostNew: string;
  passiveRestraint: string;
  annualMiles: string;
  // Vehicle-level coverages (Coverages/Bill Plans).
  compDeductible: string;
  collDeductible: string;
  rental: string;
  roadside: string;
  customEquipment: string;
  // Point of Sale garaging details.
  garagingSameAsMailing: YesNo;
  garagingStreet: string;
  garagingStreet2: string;
  garagingCity: string;
}

export interface Incident {
  id: string;
  code: string;
  date: string;
}

export type DriverStatus = '' | 'Rated' | 'Excluded';

export interface Driver {
  id: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix: string;
  maritalStatus: string;
  relationship: string;
  dob: string;
  ssn: string;
  gender: string;
  education: string;
  employment: string;
  occupation: string;
  driverStatus: DriverStatus;
  licenseType: string;
  licenseStatus: string;
  licenseState: string;
  licenseNumber: string;
  previousLicenseState: string;
  stateFiling: YesNo;
  operatorType: string;
  ageFirstLicensed: string;
  internationalYears: string;
  primaryVehicleId: string;
  distantStudent: YesNo;
  goodStudent: YesNo;
  incidents: Incident[];
}

export const CROSS_SELL_PRODUCTS = ['Renters', 'Motorcycle', 'Boat', 'Motor Home', 'Travel Trailer', 'Commercial Lines'] as const;
export type CrossSellProduct = (typeof CROSS_SELL_PRODUCTS)[number];

export interface AdditionalDetails {
  /** Insured/Spouse had liability coverage for the past 6 months with no more than a 31-day lapse. */
  continuousInsurance: YesNo;
  /** Current/most recent auto carrier, its bodily injury limits and how long with it (asked when insured). */
  priorCarrier: string;
  priorLimits: string;
  priorYears: string;
  allDriversListed: YesNo;
  priorCancellation: YesNo;
  jointOwnership: YesNo;
  paperless: YesNo;
  primaryResidence: string;
  crossSell: CrossSellProduct[];
  noAdditionalRisks: boolean;
}

// Policy-level coverages. Physical damage, rental, roadside and equipment are per vehicle.
export interface Coverages {
  bodilyInjuryPd: string;
  medicalPayments: string;
  uninsuredMotorist: string;
  umpd: string;
  snapshot: string;
  /** Personal Injury Protection limit ('' where the state has no PIP). */
  pip: string;
  /** The customer signed the state form rejecting PIP and/or UM/UIM. */
  rejectionSigned: boolean;
}

export type ReportStatus = 'not-ordered' | 'ordering' | 'cleared' | 'flagged';

/** What the prior-insurance vendor returned for the principal named insured. */
export interface VendorHistory {
  liabilityStatus: 'Yes, currently insured' | 'Yes, not currently insured' | 'No';
  carrier: string;
  biLimits: string;
  length: string;
}

export interface ReportSimulation {
  /** Credit-based insurance score tier the simulated credit report returns (0 = Preferred). */
  scoreTier: number;
  /** Prior-insurance report: confirms what the applicant said, or finds a lapse / no coverage. */
  prior: 'stated' | 'lapsed' | 'none';
}

export interface SimulatedReports {
  orderClue: boolean;
  orderMvr: boolean;
  clueStatus: ReportStatus;
  mvrStatus: ReportStatus;
  clueFindings: string[];
  mvrFindings: string[];
  vendor: VendorHistory | null;
  /** Which answer the agent accepted in the Auto Insurance History dialog. */
  priorSource: '' | 'vendor' | 'insured';
  /** Simulated insurance-score tier returned with the POS order (0 = best). */
  scoreTier: number;
  /** What the simulated vendors will return (Trainer Mode sets it; otherwise Standard and "as stated"). */
  simulation: ReportSimulation;
  orderedAt: string;
  staleReason: string;
  requestId: number;
}

export type BillPlan = '' | 'PIF' | 'EFT' | 'CARD' | 'MAIL' | 'EFT2' | 'MAIL2';

export interface PolicyInfo {
  agentCode: string;
  quoteState: string;
  quoteNumber: string;
  effectiveDate: string;
  namedOperator: YesNo;
  policyNumber: string;
  boundAt: string;
  comment: string;
}

export interface PointOfSale {
  billPlan: BillPlan;
  paymentMethod: string;
  paymentAuthorized: YesNo;
  documentDelivery: string;
  reviewedCoverages: boolean;
  confirmedHousehold: boolean;
  agreedToTerms: boolean;
}

export interface QuoteData {
  policy: PolicyInfo;
  insured: NamedInsured;
  vehicles: Vehicle[];
  drivers: Driver[];
  additional: AdditionalDetails;
  coverages: Coverages;
  reports: SimulatedReports;
  pointOfSale: PointOfSale;
  /** Signature of the rating inputs at the last RECALCULATE; the premium shows only while it matches. */
  ratedSignature: string;
  /** Set when report results re-rated the quote, so the agent can see the change. */
  premiumChange: { from: number; to: number } | null;
  /** Products on this quote, in the order they were added (Auto first when present). */
  products: ProductKey[];
  productQuotes: Partial<Record<OtherProductKey, ProductQuote>>;
}

export interface QuoteSummary {
  quoteNumber: string;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  totalPremium: number;
  billPlanName: string;
  discountsApplied: string[];
}

export type CoverageKey = 'bipd' | 'medpay' | 'otc' | 'coll' | 'ete' | 'towing' | 'cec';

export interface VehiclePremium {
  vehicleId: string;
  label: string;
  coverages: Record<CoverageKey, number>;
  total: number;
}

export interface RatingFactor {
  label: string;
  value: string;
}

export interface BillPlanQuote {
  id: Exclude<BillPlan, ''>;
  name: string;
  detail: string;
  dueToday: number;
  payments: number;
  paymentAmount: number;
  total: number;
  percentDown: number;
  feePerPayment: number;
  savings: number;
  termMonths: number;
}

export interface RatingResult {
  vehicles: VehiclePremium[];
  umbi: number;
  umpd: number;
  pip: number;
  /** 6-month premium before the Paid-in-Full discount. */
  fullTermPremium: number;
  billPlans: BillPlanQuote[];
  appliedDiscounts: string[];
  eligibleDiscounts: string[];
  factors: RatingFactor[];
  reportsApplied: boolean;
  /** Policy fees (for example an SR-22 filing fee), included in fullTermPremium. */
  fees: { label: string; amount: number }[];
  /** Step-by-step calculation of every premium on the quote. */
  worksheet: RatingWorksheet;
}

/** One line of a premium calculation: a base rate, a factor or a flat amount. */
export interface WorksheetLine {
  label: string;
  /** "$212.00" for a base rate, "×0.92" for a factor. */
  value: string;
}

export interface CoverageWorksheet {
  coverage: string;
  limit: string;
  lines: WorksheetLine[];
  premium: number;
}

export interface RatingWorksheet {
  vehicles: { label: string; principal: string; coverages: CoverageWorksheet[]; total: number }[];
  policy: CoverageWorksheet[];
  drivers: { name: string; lines: WorksheetLine[]; factor: number }[];
}
