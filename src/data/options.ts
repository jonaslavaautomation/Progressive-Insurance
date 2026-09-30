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

export const PRIMARY_RESIDENCES = ['Single Family Home', 'Condo', 'Apartment/Rented', 'Townhouse'];
/** Residences that qualify for the Homeowner discount. */
export const OWNED_RESIDENCES = ['Single Family Home', 'Condo', 'Townhouse'];

// ------------------------------------------------------------- Coverages / Bill Plans
// Each option carries its 6-month base premium per vehicle (before vehicle, driver and
// territory factors) so the rating engine and the dropdowns stay in sync.
export interface CoverageOption { value: string; label: string; base: number }

export const BI_PD: CoverageOption[] = [
  { value: '50/100/50', label: '50/100/50', base: 380 },
  { value: '100/300/100', label: '100/300/100', base: 461 },
  { value: '250/500/100', label: '250/500/100', base: 538 },
  { value: '250/500/250', label: '250/500/250', base: 577 },
];
export const MED_PAY: CoverageOption[] = [
  { value: 'None', label: 'None', base: 0 },
  { value: '1000', label: '$1,000', base: 16 },
  { value: '2000', label: '$2,000', base: 25 },
  { value: '5000', label: '$5,000', base: 42 },
];
export const OTC_DEDUCTIBLES: CoverageOption[] = [
  { value: 'None', label: 'No Coverage', base: 0 },
  { value: '100', label: '$100', base: 96 },
  { value: '250', label: '$250', base: 75 },
  { value: '500', label: '$500', base: 59 },
  { value: '1000', label: '$1,000', base: 42 },
];
export const COLL_DEDUCTIBLES: CoverageOption[] = [
  { value: 'None', label: 'No Coverage', base: 0 },
  { value: '250', label: '$250', base: 307 },
  { value: '500', label: '$500', base: 255 },
  { value: '1000', label: '$1,000', base: 191 },
];
export const ETE: CoverageOption[] = [
  { value: 'None', label: 'None', base: 0 },
  { value: '30', label: '$30/day, $900 max', base: 16 },
  { value: '40', label: '$40/day, $1,200 max', base: 21 },
  { value: '50', label: '$50/day, $1,500 max', base: 27 },
];
export const TOWING: CoverageOption[] = [
  { value: 'None', label: 'None', base: 0 },
  { value: 'Roadside', label: 'Roadside Assistance', base: 7 },
];
export const UM_BI: CoverageOption[] = [
  { value: '50/100', label: '50/100', base: 32 },
  { value: '100/300', label: '100/300', base: 44 },
  { value: '250/500', label: '250/500', base: 57 },
];
export const UMPD: CoverageOption[] = [
  { value: '50', label: '50 w/$100 Ded', base: 1.88 },
  { value: '100', label: '100 w/$100 Ded', base: 2.61 },
];
export const SNAPSHOT_OPTIONS = ['Do Not Participate', 'Enrolled - Mobile App', 'Enrolled - Plug-In Device'];
export const CUSTOM_EQUIPMENT_MAX = 5000;

export const COVERAGE_DEFAULTS = { bodilyInjuryPd: '100/300/100', medicalPayments: 'None', uninsuredMotorist: '100/300', umpd: '50', snapshot: '' };
export const VEHICLE_COVERAGE_DEFAULTS = { compDeductible: '500', collDeductible: '500', rental: 'None', roadside: 'None', customEquipment: '0' };

export const PAYMENT_METHODS = ['Bank account (EFT)', 'Credit/debit card via secure IVR', 'Customer pays online after binding'];
export const DOCUMENT_DELIVERY = ['Email (e-Sign)', 'In person (print and sign)', 'Mail'];

export function coverageOptions(options: CoverageOption[]): Option[] {
  return options.map(({ value, label }) => ({ value, label }));
}

export function optionFor(options: CoverageOption[], value: string): CoverageOption | undefined {
  return options.find((option) => option.value === value);
}

export function optionIndex(options: CoverageOption[], value: string): number {
  return options.findIndex((option) => option.value === value);
}

export function optionLabel(options: CoverageOption[], value: string): string {
  return optionFor(options, value)?.label ?? '—';
}
