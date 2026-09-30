// Config-driven model for the non-Auto products (Motorcycle/ATV, Boat/PWC, Motor Home,
// Travel Trailer, Renters). Auto keeps its dedicated model in src/types/quote.ts.
import type { BillPlan, RatingFactor } from '@/types/quote';

export type OtherProductKey = 'motorcycle' | 'boat' | 'motorhome' | 'trailer' | 'renters';
export type ProductKey = 'auto' | OtherProductKey;
/** Commercial Lines products (quoted in the separate Commercial flow). */
export type CommercialKey = 'commercialAuto' | 'bop' | 'mgmt';
/** Any product a policy can be issued for. */
export type AnyProductKey = ProductKey | CommercialKey;

export interface Choice { value: string; label: string; base?: number }

export type FieldType = 'select' | 'text' | 'money' | 'digits' | 'year' | 'zip' | 'vin' | 'hin' | 'display';

export interface FieldContext {
  /** Other values on the same unit (or the product's policy-level values). */
  values: Record<string, string>;
  /** Auto vehicles on the quote, for e.g. a trailer's tow vehicle. */
  autoVehicles: { id: string; label: string }[];
  mailingZip: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: Choice[] | ((ctx: FieldContext) => Choice[]);
  required?: boolean;
  /** Required only at Point of Sale (VIN / HIN). */
  posRequired?: boolean;
  help?: string;
  tag?: boolean;
  placeholder?: string;
  divider?: boolean;
  default?: string;
  showIf?: (ctx: FieldContext) => boolean;
  /** For `display` fields: text computed from the other values. */
  compute?: (ctx: FieldContext) => string;
}

export interface CoverageDef extends FieldDef {
  scope: 'unit' | 'policy';
}

export interface QuestionDef extends FieldDef {
  /** Answer that makes the risk ineligible for this product. */
  ineligibleIf?: string;
  ineligibleMessage?: string;
}

export interface ProductUnit {
  id: string;
  values: Record<string, string>;
  coverages: Record<string, string>;
}

export interface InterestedParty {
  id: string;
  name: string;
  address: string;
}

export interface ProductQuote {
  quoteNumber: string;
  units: ProductUnit[];
  coverages: Record<string, string>;
  answers: Record<string, string>;
  interests: InterestedParty[];
  billPlan: BillPlan;
  ratedSignature: string;
  suspended: boolean;
}

export interface UnitPremium {
  unitId: string;
  label: string;
  amounts: Record<string, number>;
  total: number;
}

export interface RateContext {
  driverFactor: number;
  territory: (zip: string) => number;
  priorFactor: number;
  scoreFactor: number;
  reportsApplied: boolean;
  multiPolicy: boolean;
  paperless: boolean;
  mvrFactor: number;
  modelYearAge: (year: string) => number;
  /** Commercial rating inputs (business profile and driver schedule). */
  commercial?: CommercialRateInputs;
}

export interface CommercialRateInputs {
  answers: Record<string, string>;
  business: Record<string, string>;
  yearsFactor: number;
  lossFactor: number;
  driverFactor: number;
  driverCount: number;
}

export interface ProductRateResult {
  units: UnitPremium[];
  policy: Record<string, number>;
  factors: RatingFactor[];
  discounts: string[];
}

export interface ProductConfig {
  key: OtherProductKey | CommercialKey;
  /** Tile / tab text as shown in the portal. */
  tileLabel: string;
  tabLabel: string;
  name: string;
  unitLabel: string;
  unitPlural: string;
  multiUnit: boolean;
  maxUnits: number;
  termMonths: 6 | 12;
  /** Needs licensed, rated operators (motorized products). */
  motorized: boolean;
  usesMvr: boolean;
  idField?: string;
  unitFields: FieldDef[];
  coverages: CoverageDef[];
  questions: QuestionDef[];
  describe: (unit: ProductUnit) => string;
  rate: (ctx: RateContext, quote: ProductQuote) => ProductRateResult;
  /** Extra eligibility rules for a unit, keyed by field. */
  unitRules?: (values: Record<string, string>) => Record<string, string>;
  minimumPremium: number;
}
