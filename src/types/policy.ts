// Issued-policy model used by Manage Policies (billing, cancellation, reinstatement, renewal).
import type { AnyProductKey } from '@/products/types';
import type { BillPlan, QuoteData } from '@/types/quote';
import type { CommercialQuote } from '@/commercial/types';

/** The rating inputs a policy was issued from; Change Policy edits a copy and re-rates it. */
export type PolicySource = { kind: 'personal'; quote: QuoteData } | { kind: 'commercial'; quote: CommercialQuote };

export type PolicyStatus = 'Active' | 'Pending Cancel' | 'Cancelled' | 'Expired' | 'Non-Renewed';

export interface InstallmentRecord {
  id: string;
  number: number;
  due: string;
  amount: number;
  paid: number;
  status: 'scheduled' | 'billed' | 'paid' | 'past due' | 'void';
  billedOn: string;
  lateFeeApplied: boolean;
}

export type LedgerType = 'Endorsement' | 'Premium' | 'Payment' | 'Automatic Payment' | 'Late Fee' | 'Returned Payment' | 'Returned Payment Fee' | 'Cancellation Credit' | 'Short Rate Penalty' | 'Refund' | 'Reinstatement' | 'Renewal Premium' | 'Bill Plan Change';

export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerType;
  /** Positive = charge to the customer, negative = payment or credit. */
  amount: number;
  detail: string;
}

export type PolicyDocumentType =
  | 'Declarations' | 'Renewal Declarations' | 'ID Cards' | 'Application' | 'FS-1 Certificate of Insurance' | 'Billing Statement' | 'Payment Receipt'
  | 'Notice of Cancellation' | 'Cancellation Confirmation' | 'Rescission of Cancellation' | 'Reinstatement Notice' | 'Renewal Offer' | 'Non-Renewal Notice'
  | 'Expiration Notice' | 'Bill Plan Change Confirmation' | 'Returned Payment Notice'
  | 'Amended Declarations' | 'Evidence of Insurance' | 'Certificate of Insurance';

export interface PolicyDocument {
  id: string;
  type: PolicyDocumentType;
  date: string;
  term: number;
  data: Record<string, string | number>;
}

export interface HistoryEntry {
  id: string;
  date: string;
  event: string;
  detail: string;
}

export interface CoverageLine {
  label: string;
  value: string;
  premium?: number;
}

export interface UnitSnapshot {
  label: string;
  details: string[];
  idNumber: string;
  coverages: CoverageLine[];
  premium: number;
}

export interface InsuredSnapshot {
  name: string;
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  street: string;
  cityStateZip: string;
}

export type CancelKind = 'nonpayment' | 'insured' | 'company';

export interface PolicyRecord {
  id: string;
  policyNumber: string;
  quoteNumber: string;
  product: AnyProductKey;
  productName: string;
  status: PolicyStatus;
  insured: InsuredSnapshot;
  drivers: string[];
  agentCode: string;
  agentName: string;
  state: string;
  termMonths: number;
  termNumber: number;
  effectiveDate: string;
  expirationDate: string;
  issuedOn: string;
  /** Selected bill plan total for the current term (includes installment fees). */
  termPremium: number;
  /** Premium before the Paid in Full discount, used to price renewals and plan changes. */
  fullTermPremium: number;
  billPlanId: Exclude<BillPlan, ''>;
  billPlanName: string;
  feePerPayment: number;
  autopay: boolean;
  paymentMethod: string;
  units: UnitSnapshot[];
  policyCoverages: CoverageLine[];
  discounts: string[];
  installments: InstallmentRecord[];
  ledger: LedgerEntry[];
  documents: PolicyDocument[];
  history: HistoryEntry[];
  esign: 'Pending' | 'Signed';
  pendingCancel: null | { kind: CancelKind; reason: string; noticeDate: string; effectiveDate: string; amountDue: number; method: 'Pro Rata' | 'Short Rate' };
  /** Late and returned-payment fees assessed and not yet paid. */
  feesDue: number;
  cancellation: null | { kind: CancelKind; reason: string; requestedOn: string; effectiveDate: string; method: 'Pro Rata' | 'Short Rate'; earned: number; paid: number; refund: number; balanceDue: number; credit: number; feesOutstanding: number };
  renewal: null | { offeredOn: string; effectiveDate: string; expirationDate: string; fullTermPremium: number; premium: number; previousPremium: number; reasons: string[]; billPlanId: Exclude<BillPlan, ''>; billPlanName: string; dueToday: number; status: 'Offered' | 'Accepted' };
  nonRenewal: null | { by: 'insured' | 'company'; noticeDate: string; reason: string };
  lapse: null | { from: string; to: string };
  source: PolicySource;
  /** Lienholders / loss payees by unit label. */
  lienholders: { id: string; unit: string; name: string; address: string; loanNumber: string; kind: 'Lienholder' | 'Lessor' }[];
}
