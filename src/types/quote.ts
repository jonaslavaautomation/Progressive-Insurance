// Core data model for the simulated auto quote. All values are strings as entered
// in the carrier UI (dates are MM/DD/YYYY) so they round-trip through form controls.

export type YesNo = '' | 'Yes' | 'No';

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
  compDeductible: string;
  collDeductible: string;
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

export interface AdditionalDetails {
  priorInsurance: YesNo;
  priorCarrier: string;
  priorBiLimits: string;
  yearsWithPrior: string;
  residenceType: string;
  yearsAtResidence: string;
  paperless: YesNo;
  eSignature: YesNo;
}

// Comprehensive/collision deductibles are rated per vehicle and live on `Vehicle`.
export interface Coverages {
  bodilyInjury: string;
  propertyDamage: string;
  uninsuredMotorist: string;
  medicalPayments: string;
  roadside: YesNo;
  rentalReimbursement: string;
}

export type ReportStatus = 'pending' | 'ordered' | 'cleared' | 'flagged';

export interface SimulatedReports {
  mvrStatus: ReportStatus;
  clueStatus: ReportStatus;
  verificationDate: string;
  mvrFindings: string[];
  clueFindings: string[];
  /** Set when driver data changed after a report came back, so the VA knows to re-order. */
  staleReason: string;
  requestId: number;
}

export type BillPlan = '' | 'Monthly - EFT' | 'Monthly - Direct Bill' | 'Paid in Full';

export interface PolicyInfo {
  agentCode: string;
  quoteState: string;
  quoteNumber: string;
  effectiveDate: string;
  namedOperator: YesNo;
  policyNumber: string;
  boundAt: string;
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
}

export interface QuoteSummary {
  quoteNumber: string;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  monthlyPremium: number;
  paidInFullPremium: number;
  discountsApplied: string[];
}

export type RatingCategory = 'base' | 'vehicle' | 'driver' | 'coverage' | 'discount';

export interface RatingLine {
  label: string;
  amount: number;
  category: RatingCategory;
}

export interface RatingResult {
  lines: RatingLine[];
  subtotal: number;
  discounts: RatingLine[];
  monthlyPremium: number;
  annualPremium: number;
  paidInFullPremium: number;
  paidInFullSavings: number;
  discountsApplied: string[];
  safeDriver: 'applied' | 'pending' | 'ineligible';
}
