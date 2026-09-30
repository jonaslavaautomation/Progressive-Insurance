// Dropdown option lists used across the quote flow.

export type Option = string | { value: string; label: string };

export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

export const YES_NO = ['Yes', 'No'];
export const SUFFIXES = ['Jr', 'Sr', 'II', 'III', 'IV'];
export const GENDERS = ['Male', 'Female', 'Not Specified'];
export const PHONE_TYPES = ['Cell', 'Home', 'Work'] as const;

export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Separated', 'Widowed', 'Domestic Partner'];
export const RELATIONSHIPS = ['Spouse', 'Domestic Partner', 'Child', 'Parent', 'Sibling', 'Other Relative', 'Other Non-Relative'];
export const EDUCATION_LEVELS = [
  'No high school diploma', 'High school diploma or GED', 'Vocational/Technical degree', 'Some college', 'Associate degree',
  "Bachelor's degree", "Master's degree", 'Doctorate degree',
];
export const OCCUPATIONS: Record<string, string[]> = {
  'Business/Sales/Office': ['Manager/Supervisor - Office', 'Sales Representative', 'Administrative Assistant', 'Accountant/Auditor', 'Customer Service Rep'],
  'Construction/Trades': ['Electrician', 'Carpenter', 'Plumber', 'Laborer', 'Foreman/Supervisor'],
  'Education/Library': ['Teacher - K-12', 'Professor', 'Librarian', 'Teacher Aide'],
  'Healthcare': ['Nurse - RN', 'Physician', 'Medical Technician', 'Pharmacist', 'Home Health Aide'],
  'Military': ['Enlisted', 'Officer'],
  'Homemaker/Houseperson': ['Homemaker/Houseperson'],
  'Retired': ['Retired'],
  'Student': ['Student - Full Time', 'Student - Part Time'],
  'Unemployed': ['Unemployed'],
};
export const EMPLOYMENT = Object.keys(OCCUPATIONS);

export const DRIVER_STATUSES = ['Rated', 'Excluded'];
export const LICENSE_TYPES = ['Personal Auto', 'Commercial (CDL)', 'Learner Permit', 'Foreign/International', 'Not Licensed'];
export const LICENSE_STATUSES = ['Valid', 'Suspended', 'Revoked', 'Expired'];
export const OPERATOR_TYPES = ['Principal', 'Occasional'];
export const INTERNATIONAL_YEARS = ['None', 'Less than 1 year', '1 year', '2 years', '3 or more years'];

export type IncidentKind = 'violation' | 'accident' | 'claim';
export const INCIDENT_CODES: { value: string; label: string; kind: IncidentKind }[] = [
  { value: 'AAF', label: 'At-fault accident', kind: 'accident' },
  { value: 'NAF', label: 'Not-at-fault accident', kind: 'accident' },
  { value: 'SP1', label: 'Speeding 1-15 mph over', kind: 'violation' },
  { value: 'SP2', label: 'Speeding 16+ mph over', kind: 'violation' },
  { value: 'FTY', label: 'Failure to yield', kind: 'violation' },
  { value: 'RLT', label: 'Running red light/stop sign', kind: 'violation' },
  { value: 'DWI', label: 'DUI/DWI', kind: 'violation' },
  { value: 'CMP', label: 'Comprehensive claim (glass, theft, weather)', kind: 'claim' },
];

export const VEHICLE_TYPES = ['1981 & Newer - Autos, Pickups, Vans, SUVs', 'Pre-1981 - Classic/Antique', 'Low Speed Vehicle'];
export const OWNERSHIP_LENGTHS = ['Less than 1 month', 'At least 1 month but less than 6 months', 'At least 6 months but less than 1 year', 'At least 1 year but less than 3 years', 'At least 3 years but less than 5 years', '5 years or more'];
export const PRIMARY_USES = ['1A - Pleasure', '2A - Commute', '3A - Business', '4A - Farm'];
export const ANNUAL_MILES = ['0 - 3,999', '4,000 - 5,999', '6,000 - 7,999', '8,000 - 9,999', '10,000 - 11,999', '12,000 - 14,999', '15,000 - 19,999', '20,000 or more'];

export const PRIOR_CARRIERS = ['Allstate', 'GEICO', 'Nationwide', 'NC Farm Bureau', 'State Farm', 'USAA', 'Other carrier'];
export const PRIOR_BI_LIMITS = ['30/60', '50/100', '100/300', '250/500', 'Greater than 250/500'];
export const YEARS_WITH_PRIOR = ['Less than 6 months', '6 months to 1 year', '1 to 3 years', '3 to 5 years', '5 years or more'];
export const RESIDENCE_TYPES = ['Own home', 'Own condo', 'Own mobile home', 'Rent', 'Live with parents', 'Other'];
export const YEARS_AT_RESIDENCE = ['Less than 1 year', '1 to 2 years', '3 to 5 years', 'More than 5 years'];

// Coverage tiers carry their monthly surcharge so the rating engine and UI stay in sync.
export interface CoverageTier { value: string; label: string; monthly: number }
export const BI_LIMITS: CoverageTier[] = [
  { value: '50/100', label: '$50,000/$100,000 (NC minimum)', monthly: 0 },
  { value: '100/200', label: '$100,000/$200,000', monthly: 20 },
  { value: '100/300', label: '$100,000/$300,000', monthly: 35 },
  { value: '250/500', label: '$250,000/$500,000', monthly: 50 },
];
export const PD_LIMITS: CoverageTier[] = [
  { value: '50000', label: '$50,000 (NC minimum)', monthly: 0 },
  { value: '100000', label: '$100,000', monthly: 20 },
  { value: '250000', label: '$250,000', monthly: 35 },
  { value: '500000', label: '$500,000', monthly: 50 },
];
export const UM_LIMITS: CoverageTier[] = [
  { value: '50/100', label: '$50,000/$100,000', monthly: 0 },
  { value: '100/200', label: '$100,000/$200,000', monthly: 4 },
  { value: '100/300', label: '$100,000/$300,000', monthly: 6 },
  { value: '250/500', label: '$250,000/$500,000', monthly: 9 },
];
export const MED_PAY: CoverageTier[] = [
  { value: 'None', label: 'No Coverage', monthly: 0 },
  { value: '1000', label: '$1,000', monthly: 3 },
  { value: '2000', label: '$2,000', monthly: 5 },
  { value: '5000', label: '$5,000', monthly: 8 },
];
export const DEDUCTIBLES: CoverageTier[] = [
  { value: 'None', label: 'No Coverage', monthly: -15 },
  { value: '250', label: '$250 deductible', monthly: 30 },
  { value: '500', label: '$500 deductible', monthly: 15 },
  { value: '1000', label: '$1,000 deductible', monthly: 0 },
];
export const RENTAL: CoverageTier[] = [
  { value: 'None', label: 'No Coverage', monthly: 0 },
  { value: '30', label: '$30/day, $900 max', monthly: 5 },
  { value: '40', label: '$40/day, $1,200 max', monthly: 7 },
  { value: '50', label: '$50/day, $1,500 max', monthly: 9 },
];
export const ROADSIDE_MONTHLY = 4;

export const BILL_PLANS = ['Monthly - EFT', 'Monthly - Direct Bill', 'Paid in Full'] as const;
export const PAYMENT_METHODS = ['Bank account (EFT)', 'Credit/debit card via secure IVR', 'Customer pays online after binding'];
export const DOCUMENT_DELIVERY = ['Email (e-Sign)', 'In person (print and sign)', 'Mail'];

export function tierOptions(tiers: CoverageTier[]): Option[] {
  return tiers.map(({ value, label }) => ({ value, label }));
}

export function tierFor(tiers: CoverageTier[], value: string): CoverageTier | undefined {
  return tiers.find((tier) => tier.value === value);
}

export function tierIndex(tiers: CoverageTier[], value: string): number {
  return tiers.findIndex((tier) => tier.value === value);
}
