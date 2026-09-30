import type { PolicyDocument } from '@/types/policy';

export const DOCUMENT_TITLES: Record<PolicyDocument['type'], string> = {
  Declarations: 'Declarations Page',
  'Renewal Declarations': 'Renewal Declarations Page',
  'ID Cards': 'Insurance Identification Cards',
  Application: 'Application for Insurance',
  'FS-1 Certificate of Insurance': 'FS-1 Certification of Liability Insurance',
  'Billing Statement': 'Billing Statement',
  'Payment Receipt': 'Payment Receipt',
  'Notice of Cancellation': 'Notice of Cancellation',
  'Cancellation Confirmation': 'Cancellation Confirmation',
  'Rescission of Cancellation': 'Rescission of Cancellation Notice',
  'Reinstatement Notice': 'Reinstatement Notice',
  'Renewal Offer': 'Renewal Offer',
  'Non-Renewal Notice': 'Notice of Non-Renewal',
  'Expiration Notice': 'Policy Expiration Notice',
  'Bill Plan Change Confirmation': 'Bill Plan Change Confirmation',
  'Returned Payment Notice': 'Returned Payment Notice',
  'Amended Declarations': 'Amended Declarations Page',
  'Evidence of Insurance': 'Evidence of Insurance (Lienholder Copy)',
  'Certificate of Insurance': 'Certificate of Liability Insurance',
};
