// Commercial Lines quote model (Commercial Auto, Businessowners/Contractor GL, Management Liability).
import type { CommercialKey, ProductQuote } from '@/products/types';

export interface CommercialDriver {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  licenseState: string;
  licenseNumber: string;
  licenseType: string;
  experience: string;
  violations: string;
  accidents: string;
}

export interface CommercialQuote {
  products: CommercialKey[];
  /** Business information values keyed by field (see BUSINESS_FIELDS). */
  business: Record<string, string>;
  drivers: CommercialDriver[];
  productQuotes: Partial<Record<CommercialKey, ProductQuote>>;
  /** Shared underwriting answers (business-wide). */
  answers: Record<string, string>;
  effectiveDate: string;
  paymentMethod: string;
  paymentAuthorized: string;
  signedApplication: boolean;
  confirmedAccuracy: boolean;
  step: number;
  maxStep: number;
  active: CommercialKey;
  boundPolicyIds: string[];
}
