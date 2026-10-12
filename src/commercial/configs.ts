// Commercial Lines product definitions and business profile fields.
// Rates are annual training rates; factors follow common small-commercial practice.
import type { CommercialKey, CoverageDef, FieldDef, ProductConfig, ProductQuote, ProductRateResult, QuestionDef, RateContext, UnitPremium } from '@/products/types';
import { YEAR_CHOICES, YES_NO_CHOICES, band, baseOf, choices, clamp, factor, money, pct, round2 } from '@/products/helpers';
import { US_STATES } from '@/data/options';

/** gl: rate per $1,000 of gross sales; glPayroll: rate per $1,000 of payroll (contractor classes). */
export interface Industry { auto: number; gl: number; glPayroll?: number; bop: boolean; epl: number; contractor: boolean }
export const INDUSTRIES: Record<string, Industry> = {
  'Artisan Contractor - Carpentry': { auto: 1.15, gl: 5.2, glPayroll: 13.5, bop: false, epl: 1, contractor: true },
  'Artisan Contractor - Electrical': { auto: 1.1, gl: 4.1, glPayroll: 8.5, bop: false, epl: 1, contractor: true },
  'Artisan Contractor - Plumbing/HVAC': { auto: 1.15, gl: 4.6, glPayroll: 10.5, bop: false, epl: 1, contractor: true },
  'Landscaping/Lawn Care': { auto: 1.1, gl: 3.4, glPayroll: 7.5, bop: false, epl: 1.05, contractor: true },
  'Janitorial/Cleaning Services': { auto: 0.95, gl: 2.4, glPayroll: 5.5, bop: false, epl: 1.15, contractor: true },
  'Retail Store': { auto: 0.9, gl: 1.1, bop: true, epl: 1.1, contractor: false },
  'Restaurant (limited cooking)': { auto: 1, gl: 1.9, bop: true, epl: 1.4, contractor: false },
  'Office/Professional Services': { auto: 0.8, gl: 0.45, bop: true, epl: 0.9, contractor: false },
  'Food Truck/Catering': { auto: 1.2, gl: 2.2, bop: false, epl: 1.25, contractor: false },
  'Courier/Local Delivery': { auto: 1.45, gl: 0.9, bop: false, epl: 1.1, contractor: false },
  'For-Hire Trucking': { auto: 2.2, gl: 0.8, bop: false, epl: 1.05, contractor: false },
  'Nonprofit Organization': { auto: 0.9, gl: 0.7, bop: true, epl: 1.2, contractor: false },
};
const industryOf = (ctx: RateContext) => INDUSTRIES[ctx.commercial?.business.industry ?? ''] ?? INDUSTRIES['Office/Professional Services'];

/** 2022 NAICS code for each industry class (shown on the application). */
export const NAICS: Record<string, string> = {
  'Artisan Contractor - Carpentry': '238350 Finish Carpentry Contractors',
  'Artisan Contractor - Electrical': '238210 Electrical Contractors',
  'Artisan Contractor - Plumbing/HVAC': '238220 Plumbing, Heating and Air-Conditioning Contractors',
  'Landscaping/Lawn Care': '561730 Landscaping Services',
  'Janitorial/Cleaning Services': '561720 Janitorial Services',
  'Retail Store': '455219 All Other General Merchandise Retailers',
  'Restaurant (limited cooking)': '722513 Limited-Service Restaurants',
  'Office/Professional Services': '541990 All Other Professional, Scientific and Technical Services',
  'Food Truck/Catering': '722330 Mobile Food Services',
  'Courier/Local Delivery': '492210 Local Messengers and Local Delivery',
  'For-Hire Trucking': '484121 General Freight Trucking, Long-Distance, Truckload',
  'Nonprofit Organization': '813319 Other Social Advocacy Organizations',
};
const isContractor = (business?: Record<string, string>) => !!INDUSTRIES[business?.industry ?? '']?.contractor;
const servesFood = (business?: Record<string, string>) => /Restaurant|Food/.test(business?.industry ?? '');
export const DRIVER_ROLES = ['Owner / Officer', 'Employee', 'Family member of owner', 'Independent contractor'];

export const YEARS_IN_BUSINESS = choices(['New venture (less than 1 year)', '1 to 2 years', '3 to 5 years', 'More than 5 years']);
export const YEARS_FACTOR: Record<string, number> = { 'New venture (less than 1 year)': 1.35, '1 to 2 years': 1.15, '3 to 5 years': 1, 'More than 5 years': 0.92 };

export const BUSINESS_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Business Name:*', type: 'text', required: true, help: 'The legal name exactly as it appears on the business registration or tax filings.' },
  { key: 'dba', label: 'DBA (Doing Business As):', type: 'text' },
  { key: 'entity', label: 'Business Entity Type:*', type: 'select', required: true, options: choices(['Sole Proprietor', 'Partnership', 'Limited Liability Company (LLC)', 'Corporation', 'Nonprofit Organization']) },
  { key: 'fein', label: 'FEIN / Tax ID:', type: 'digits', placeholder: '9 digits', help: 'Federal Employer Identification Number. Sole proprietors without employees may leave this blank.' },
  { key: 'industry', label: 'Business Type (Industry):*', type: 'select', required: true, options: choices(Object.keys(INDUSTRIES)), help: 'The industry class drives eligibility and rates for every commercial product. Choose the class that describes most of the revenue.' },
  { key: 'naics', label: 'NAICS Code:', type: 'display', compute: ({ values }) => NAICS[values.industry] ?? 'Select the business type' },
  { key: 'operations', label: 'Describe Business Operations:*', type: 'text', required: true, placeholder: 'e.g. residential remodeling' },
  { key: 'yearsInBusiness', label: 'Years in Business:*', type: 'select', required: true, tag: true, options: YEARS_IN_BUSINESS },
  { key: 'street', label: 'Business Street Address:*', type: 'text', required: true, divider: true },
  { key: 'city', label: 'City:*', type: 'text', required: true },
  { key: 'state', label: 'State:*', type: 'select', required: true, default: 'North Carolina', options: choices(US_STATES) },
  { key: 'zip', label: 'ZIP Code:*', type: 'zip', required: true },
  { key: 'contact', label: 'Primary Contact Name:*', type: 'text', required: true, divider: true },
  { key: 'contactTitle', label: 'Contact Title:*', type: 'select', required: true, options: choices(['Owner', 'Partner', 'President / CEO', 'Officer', 'Office Manager', 'Other authorized representative']), help: 'The application must be signed by an owner, partner or officer.' },
  { key: 'phone', label: 'Business Phone:*', type: 'text', required: true, placeholder: 'XXX-XXX-XXXX' },
  { key: 'email', label: 'Business Email:*', type: 'text', required: true },
  { key: 'website', label: 'Website:', type: 'text', placeholder: 'www.example.com' },
  { key: 'revenue', label: 'Annual Gross Revenue:*', type: 'money', required: true, tag: true, divider: true },
  { key: 'employees', label: 'Number of Employees:*', type: 'digits', required: true, tag: true, help: 'Total full- and part-time employees, including owners who work in the business.' },
  { key: 'payroll', label: 'Annual Payroll:*', type: 'money', required: true, help: 'Total annual payroll, excluding owners not on payroll. Contractor General Liability is rated per $1,000 of payroll.' },
  { key: 'subcontractCost', label: 'Annual Cost of Subcontracted Work:*', type: 'money', required: true, help: 'Paid to 1099 subcontractors. Uninsured subcontractor costs are charged as payroll at audit.', showIf: ({ values }) => !!INDUSTRIES[values.industry]?.contractor },
];

/** Prior carrier and loss history (ACORD 125 prior carrier information and loss history). */
export const SHARED_QUESTIONS: QuestionDef[] = [
  { key: 'priorCoverage', label: 'Has the business had continuous commercial insurance for the past 12 months?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
  { key: 'priorCarrier', label: 'Prior (current) carrier:*', type: 'text', required: true, showIf: ({ values }) => values.priorCoverage === 'Yes' },
  { key: 'priorPremium', label: 'Prior annual premium (all lines):*', type: 'money', required: true, showIf: ({ values }) => values.priorCoverage === 'Yes' },
  { key: 'losses', label: 'Number of commercial insurance claims in the past 3 years:*', type: 'select', required: true, options: choices(['0', '1', '2', '3 or more']) },
  { key: 'lossPaid', label: 'Total paid and reserved on those claims:*', type: 'money', required: true, showIf: ({ values }) => !!values.losses && values.losses !== '0', help: 'From the prior carrier loss runs (currently valued, 3 to 5 years).' },
  { key: 'cancelled', label: 'Has any policy or coverage been declined, cancelled or non-renewed in the past 3 years (other than for nonpayment)?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Businesses with a prior declination, cancellation or non-renewal must be referred to underwriting.' },
  { key: 'bankruptcy', label: 'Has the business had a foreclosure, repossession or bankruptcy, or filed for bankruptcy, in the past 5 years?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'A foreclosure, repossession or bankruptcy in the past 5 years requires underwriting referral.' },
];

/** ACORD 125 general information questions. Every "Yes" must be explained to underwriting. */
export const GENERAL_QUESTIONS: QuestionDef[] = [
  { key: 'subsidiaryOf', label: 'Is the business a subsidiary of another entity?*', type: 'select', required: true, options: YES_NO_CHOICES },
  { key: 'subsidiaries', label: 'Does the business have any subsidiaries?*', type: 'select', required: true, options: YES_NO_CHOICES },
  { key: 'safetyProgram', label: 'Is a formal, written safety program in operation?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES, help: 'Written safety rules, training and accident reporting. Earns a safety program credit.' },
  { key: 'flammables', label: 'Any exposure to flammables, explosives or chemicals?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Exposure to flammables, explosives or chemicals must be referred to underwriting.' },
  { key: 'otherVentures', label: 'Does the business have other ventures for which coverage is not requested?*', type: 'select', required: true, options: YES_NO_CHOICES },
  { key: 'abuse', label: 'Any past losses or claims relating to sexual abuse or molestation, discrimination or negligent hiring?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Abuse, discrimination or negligent hiring claims must be referred to underwriting.' },
  { key: 'fraud', label: 'In the past 5 years, has any owner or officer been indicted for or convicted of fraud, bribery, arson or any other arson-related crime?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'A fraud, bribery or arson indictment or conviction makes the business ineligible.' },
  { key: 'codeViolations', label: 'Any uncorrected fire or safety code violations?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Fire or safety code violations must be corrected before binding.' },
  { key: 'judgment', label: 'Any judgment or lien against the business in the past 5 years?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'A judgment or lien in the past 5 years requires underwriting referral.' },
  { key: 'trust', label: 'Has the business been placed in a trust?*', type: 'select', required: true, options: YES_NO_CHOICES },
  { key: 'foreign', label: 'Any foreign operations, or foreign products distributed in the USA?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Foreign operations or imported products need underwriting review (products liability).' },
  { key: 'drones', label: 'Does the business own, lease or operate any drones?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Aircraft, including drones, are excluded from General Liability and need a separate aviation policy.' },
];

export const DRIVER_LICENSE_TYPES = ['Standard (Class C)', 'CDL - Class A', 'CDL - Class B'];
export const DRIVER_EXPERIENCE = ['Less than 2 years', '2 to 5 years', 'More than 5 years'];
export const DRIVER_VIOLATIONS = ['0', '1', '2', '3 or more'];
export const DRIVER_ACCIDENTS = ['0', '1', '2 or more'];

function commonDiscounts(ctx: RateContext, extra: [boolean, string, number][] = []) {
  const list: [boolean, string, number][] = [[ctx.multiPolicy, 'Multi Policy (Commercial)', 0.92], [ctx.commercial?.answers.safetyProgram === 'Yes', 'Formal Safety Program', 0.96], ...extra];
  const applied = list.filter(([on]) => on);
  return { factor: applied.reduce((product, [, , value]) => product * value, 1), names: applied.map(([, name]) => name), factors: applied.map(([, name, value]) => ({ label: `${name} discount`, value: pct(value) })) };
}

function baseFactors(ctx: RateContext) {
  const commercial = ctx.commercial;
  return [
    { label: 'Industry class', value: commercial?.business.industry || '—' },
    { label: 'Years in business', value: pct(commercial?.yearsFactor ?? 1) },
    { label: 'Loss history / prior coverage', value: pct(commercial?.lossFactor ?? 1) },
  ];
}

const totalOf = (amounts: Record<string, number>) => round2(Object.values(amounts).reduce((sum, amount) => sum + amount, 0));
const describeVehicle = (unit: ProductQuote['units'][number]) => [unit.values.year, unit.values.make, unit.values.model].filter(Boolean).join(' ') || unit.values.type || 'New Vehicle';

// ------------------------------------------------------------------ Commercial Auto

const deductible = (key: string, label: string): CoverageDef => ({ key, label, type: 'select', scope: 'unit', required: true, default: '1000', options: choices([['None', 'No Coverage'], ['500', '$500'], ['1000', '$1,000'], ['2500', '$2,500']]) });

// Size classes follow the ISO/CAR commercial auto manual: light (10,000 lbs GVW or less), medium
// (10,001-20,000), heavy (20,001-45,000) and extra-heavy (over 45,000). The heavy class is split at
// 26,001 lbs, where a CDL is required. Business use (service, retail, commercial) and radius
// (local up to 50 miles, intermediate 51-200, long distance over 200) are rated together with size.
export const CA_SIZES = ['Light (10,000 lbs or less)', 'Medium (10,001 - 20,000 lbs)', 'Heavy (20,001 - 26,000 lbs)', 'Heavy (26,001 - 45,000 lbs, CDL)', 'Extra-Heavy (over 45,000 lbs, CDL)'];
export const CA_USES = ['Service (carries tools/equipment to job sites)', 'Retail (delivers to households)', 'Commercial (hauls own goods/property)', 'For-hire (hauls goods of others)'];
export const CA_RADIUS = ['Local (up to 50 miles)', 'Intermediate (51 - 200 miles)', 'Long distance (over 200 miles)'];
/** Size x use relativities (service / retail / commercial), patterned on the CAR fleet rating table. */
const SIZE_USE: Record<string, [number, number, number]> = {
  'Light (10,000 lbs or less)': [1, 1.4, 1.6],
  'Medium (10,001 - 20,000 lbs)': [1.3, 1.6, 1.8],
  'Heavy (20,001 - 26,000 lbs)': [1.6, 2, 2.3],
  'Heavy (26,001 - 45,000 lbs, CDL)': [1.8, 2.2, 2.5],
  'Extra-Heavy (over 45,000 lbs, CDL)': [2.1, 2.5, 2.8],
};
const RADIUS_FACTOR: Record<string, number> = { 'Local (up to 50 miles)': 1, 'Intermediate (51 - 200 miles)': 1.25, 'Long distance (over 200 miles)': 1.55 };
/** Physical damage rate per $100 of stated amount by size (comprehensive / collision). */
const PD_RATES: Record<string, [number, number]> = { 'Light (10,000 lbs or less)': [0.8, 2.2], 'Medium (10,001 - 20,000 lbs)': [0.8, 2.3], 'Heavy (20,001 - 26,000 lbs)': [0.85, 2.4], 'Heavy (26,001 - 45,000 lbs, CDL)': [0.9, 2.5], 'Extra-Heavy (over 45,000 lbs, CDL)': [0.9, 2.6] };
export const needsCdl = (size: string | undefined) => !!size && size.includes('CDL');

const commercialAuto: ProductConfig = {
  key: 'commercialAuto', tileLabel: 'COMMERCIAL AUTO', tabLabel: 'COMMERCIAL AUTO', name: 'Commercial Auto', unitLabel: 'Vehicle', unitPlural: 'Vehicles', multiUnit: true, maxUnits: 10, termMonths: 12, motorized: true, usesMvr: true, idField: 'vin', minimumPremium: 900,
  unitFields: [
    { key: 'type', label: 'Vehicle Type:*', type: 'select', required: true, options: choices(['Private Passenger Auto', 'Pickup Truck', 'Cargo Van', 'Passenger Van (15 or fewer seats)', 'Box Truck', 'Dump Truck', 'Flatbed/Stake Truck']), help: 'Truck-tractors hauling for others are quoted under Trucking.' },
    { key: 'vin', label: 'VIN:', type: 'vin', posRequired: true, help: 'Required before binding. A 17-character VIN (no I, O or Q).' },
    { key: 'year', label: 'Year:*', type: 'select', required: true, options: YEAR_CHOICES },
    { key: 'make', label: 'Make:*', type: 'select', required: true, options: choices(['Ford', 'Chevrolet', 'Ram', 'GMC', 'Toyota', 'Nissan', 'Isuzu', 'Hino', 'Freightliner', 'International', 'Mercedes-Benz', 'Other']) },
    { key: 'model', label: 'Model:*', type: 'text', required: true },
    { key: 'gvw', label: 'Size Class (GVW):*', type: 'select', required: true, tag: true, options: choices(CA_SIZES), help: 'Gross Vehicle Weight Rating from the door-jamb sticker. ISO size classes: light 10,000 lbs or less, medium 10,001-20,000, heavy 20,001-45,000, extra-heavy over 45,000. 26,001 lbs or more needs a CDL driver.' },
    { key: 'use', label: 'Business Use Class:*', type: 'select', required: true, tag: true, options: choices(CA_USES), help: 'Service: carries the insured\'s tools and equipment to job sites, parked most of the day. Retail: delivers to households. Commercial: hauls the insured\'s own goods or property.' },
    { key: 'radius', label: 'Radius of Operation:*', type: 'select', required: true, tag: true, options: choices(CA_RADIUS), help: 'The farthest the vehicle regularly travels from where it is garaged, in a straight line.' },
    { key: 'value', label: 'Stated Amount (Vehicle Value):*', type: 'money', required: true, tag: true },
    { key: 'garagingZip', label: 'Garaging Zip Code:*', type: 'zip', required: true },
  ],
  coverages: [
    { key: 'liability', label: 'Liability (Combined Single Limit):*', type: 'select', scope: 'policy', required: true, default: '1000000', options: choices([['300000', '$300,000 CSL', 1050], ['500000', '$500,000 CSL', 1250], ['750000', '$750,000 CSL', 1400], ['1000000', '$1,000,000 CSL', 1550]]), help: 'Every option exceeds the state minimum. Many customer contracts require $1,000,000; ask for any contract requirement.' },
    { key: 'um', label: 'Uninsured/Underinsured Motorist (CSL):*', type: 'select', scope: 'policy', required: true, default: '300000', options: choices([['300000', '$300,000', 60], ['500000', '$500,000', 80], ['1000000', '$1,000,000', 110]]) },
    { key: 'medpay', label: 'Medical Payments:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['2000', '$2,000', 20], ['5000', '$5,000', 35]]) },
    { key: 'hnoa', label: 'Hired & Non-Owned Auto:*', type: 'select', scope: 'policy', required: true, default: 'No', tag: true, options: choices([['No', 'No', 0], ['Yes', 'Yes', 145]]), help: 'Covers liability when employees drive rented or personal vehicles for the business.' },
    deductible('comp', 'Comprehensive Deductible:*'),
    deductible('coll', 'Collision Deductible:*'),
    { key: 'rental', label: 'Rental Reimbursement:*', type: 'select', scope: 'unit', required: true, default: 'None', options: choices([['None', 'None', 0], ['50', '$50/day, 30 days', 60], ['100', '$100/day, 30 days', 105]]) },
    { key: 'towing', label: 'Roadside Assistance:*', type: 'select', scope: 'unit', required: true, default: 'None', options: choices([['None', 'None', 0], ['Yes', 'Yes', 40]]) },
  ],
  questions: [
    { key: 'hazmat', label: 'Does the business transport hazardous materials requiring placards?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Placarded hazardous materials haulers are not eligible. Federal minimums for hazmat are $1,000,000 to $5,000,000 (49 CFR 387.9).' },
    { key: 'interstate', label: 'Does any vehicle cross state lines for the business (interstate commerce)?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Vehicles over 10,000 lbs GVWR used in interstate commerce need a USDOT number.' },
    { key: 'usdot', label: 'USDOT Number:*', type: 'digits', required: true, showIf: ({ values }) => values.interstate === 'Yes' },
    { key: 'mvrReview', label: 'Does the business obtain MVRs on every driver at hire and at least annually?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'notOwned', label: 'Except for loans or leases, are any vehicles not solely owned by and registered to the business?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'A vehicle titled to an owner personally can be scheduled; the owner is added as an additional insured.' },
    { key: 'employeeAutos', label: 'Do over 50% of employees use their own autos in the business?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'If yes, add Hired & Non-Owned Auto Liability: the business is liable when employees drive their own cars for work.' },
    { key: 'maintenance', label: 'Is there a written vehicle maintenance program in operation?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'leasedToOthers', label: 'Are any vehicles leased or rented to others?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Vehicles leased or rented to others are not eligible for this program.' },
    { key: 'customized', label: 'Are any vehicles customized, altered or fitted with special equipment (lifts, plows, racks, wraps)?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Include the cost of custom equipment in each vehicle\'s Stated Amount, or it is not covered.' },
    { key: 'familyUse', label: 'Are any vehicles used by family members of the owner?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Every family member who drives a business vehicle must be on the driver schedule.' },
    { key: 'hiringStandard', label: 'Does the business have written driver hiring standards (minimum age, experience and MVR criteria)?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'noWorkComp', label: 'Are any drivers not covered by workers compensation?*', type: 'select', required: true, options: YES_NO_CHOICES },
    { key: 'unscheduled', label: 'Any vehicles owned but not scheduled on this application?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Every owned vehicle must be scheduled on the policy.' },
    { key: 'passengers', label: 'Are vehicles used to carry passengers for a fee (shuttle, rideshare, livery)?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Transporting passengers for a fee needs a public transportation policy.' },
    { key: 'holdHarmless', label: 'Has the business signed any hold harmless agreements?*', type: 'select', required: true, options: YES_NO_CHOICES },
  ],
  unitRules: (values): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (values.use === 'For-hire (hauls goods of others)') errors.use = 'For-hire hauling of goods for others is quoted under Trucking (it needs operating authority, federal filings and cargo coverage).';
    if (values.type === 'Private Passenger Auto' && values.gvw && values.gvw !== CA_SIZES[0]) errors.gvw = 'A private passenger auto is in the light size class (10,000 lbs or less).';
    if ((values.type === 'Pickup Truck' || values.type === 'Cargo Van') && needsCdl(values.gvw)) errors.gvw = 'Check the GVWR: pickups and cargo vans are not over 26,000 lbs.';
    return errors;
  },
  describe: describeVehicle,
  rate(ctx, quote): ProductRateResult {
    const commercial = ctx.commercial;
    const mvr = quote.answers.mvrReview === 'Yes';
    const discounts = commonDiscounts(ctx, [[mvr, 'Driver MVR Review', 0.95], [quote.answers.maintenance === 'Yes', 'Vehicle Maintenance Program', 0.97], [quote.answers.hiringStandard === 'Yes', 'Driver Hiring Standards', 0.97]]);
    const industry = industryOf(ctx);
    // The industry adjusts the rate gently; size, use and radius carry most of the exposure.
    const industryFactor = Math.sqrt(industry.auto);
    const load = (commercial?.yearsFactor ?? 1) * (commercial?.lossFactor ?? 1);
    const drivers = commercial?.driverFactor ?? 1;
    const extraDrivers = Math.max(0, (commercial?.driverCount ?? 0) - quote.units.length) * 0.08;
    const def = (key: string) => commercialAuto.coverages.find((entry) => entry.key === key);
    const units = quote.units.map((unit, index): UnitPremium => {
      const v = unit.values;
      const useIndex = Math.max(0, CA_USES.indexOf(v.use));
      const sizeUse = (SIZE_USE[v.gvw] ?? SIZE_USE[CA_SIZES[0]])[Math.min(useIndex, 2)];
      const passenger = v.type === 'Passenger Van (15 or fewer seats)' ? 1.25 : v.type === 'Private Passenger Auto' ? 0.9 : 1;
      const radius = factor(RADIUS_FACTOR, v.radius);
      const value = money(v.value) || 30000;
      const [compRate, collRate] = PD_RATES[v.gvw] ?? PD_RATES[CA_SIZES[0]];
      const dedFactor = (ded: string) => factor({ '500': 1.15, '1000': 1, '2500': 0.85 }, ded, 0);
      const territory = ctx.territory(v.garagingZip ?? '');
      const people = drivers * (1 + extraDrivers) * load;
      const amounts: Record<string, number> = {
        liability: baseOf(def('liability'), quote.coverages.liability) * sizeUse * passenger * radius * industryFactor * territory * people * discounts.factor,
        um: baseOf(def('um'), quote.coverages.um),
        medpay: baseOf(def('medpay'), quote.coverages.medpay) * passenger,
        hnoa: index === 0 ? baseOf(def('hnoa'), quote.coverages.hnoa) * industryFactor : 0,
        comp: value / 100 * compRate * dedFactor(unit.coverages.comp) * territory * discounts.factor,
        coll: value / 100 * collRate * dedFactor(unit.coverages.coll) * radius * people * discounts.factor,
        rental: baseOf(def('rental'), unit.coverages.rental),
        towing: baseOf(def('towing'), unit.coverages.towing),
      };
      const rounded = Object.fromEntries(Object.entries(amounts).map(([key, amount]) => [key, round2(amount)]));
      return { unitId: unit.id, label: describeVehicle(unit), amounts: rounded, total: totalOf(rounded) };
    });
    const first = quote.units[0]?.values ?? {};
    return {
      units, policy: {}, discounts: discounts.names,
      factors: [
        ...baseFactors(ctx),
        { label: 'Industry adjustment', value: pct(industryFactor) },
        { label: `Size x use (vehicle 1: ${first.gvw?.split(' (')[0] || '—'}, ${first.use?.split(' (')[0] || '—'})`, value: pct((SIZE_USE[first.gvw] ?? SIZE_USE[CA_SIZES[0]])[Math.min(Math.max(0, CA_USES.indexOf(first.use)), 2)]) },
        { label: `Radius (vehicle 1: ${first.radius?.split(' (')[0] || '—'})`, value: pct(factor(RADIUS_FACTOR, first.radius)) },
        { label: 'Driver schedule', value: pct(drivers) },
        ...discounts.factors,
      ],
    };
  },
};

// ------------------------------------------------------------------ Businessowners / Contractor GL

const bop: ProductConfig = {
  key: 'bop', tileLabel: 'BUSINESSOWNER/ CONTRACTOR GL', tabLabel: 'BOP / GL', name: 'Businessowners / Contractor GL', unitLabel: 'Location', unitPlural: 'Locations', multiUnit: true, maxUnits: 3, termMonths: 12, motorized: false, usesMvr: false, minimumPremium: 500,
  unitFields: [
    { key: 'street', label: 'Location Street Address:*', type: 'text', required: true },
    { key: 'city', label: 'City:*', type: 'text', required: true },
    { key: 'garagingZip', label: 'ZIP Code:*', type: 'zip', required: true },
    { key: 'occupancy', label: 'Occupancy:*', type: 'select', required: true, options: choices(['Own building', 'Lease space', 'Home-based business', 'Job sites only (no premises)']) },
    { key: 'buildingValue', label: 'Building Replacement Cost:*', type: 'money', required: true, tag: true, showIf: ({ values }) => values.occupancy === 'Own building' },
    { key: 'bppValue', label: 'Business Personal Property:*', type: 'money', required: true, tag: true, help: 'Furniture, equipment, inventory and supplies owned by the business at this location.', showIf: ({ values }) => values.occupancy !== 'Job sites only (no premises)' },
    { key: 'squareFeet', label: 'Square Footage:*', type: 'digits', required: true, showIf: ({ values }) => values.occupancy !== 'Job sites only (no premises)' },
    { key: 'construction', label: 'Construction Type:*', type: 'select', required: true, tag: true, options: choices(['Frame', 'Joisted Masonry', 'Masonry Non-Combustible', 'Fire Resistive']), showIf: ({ values }) => values.occupancy !== 'Job sites only (no premises)' },
    { key: 'yearBuilt', label: 'Year Built:*', type: 'digits', required: true, showIf: ({ values }) => values.occupancy !== 'Job sites only (no premises)' },
    { key: 'sprinklered', label: 'Automatic Sprinklers:*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES, showIf: ({ values }) => values.occupancy !== 'Job sites only (no premises)' },
    { key: 'alarm', label: 'Burglar Alarm:*', type: 'select', required: true, tag: true, options: choices(['None', 'Local Alarm', 'Central Station Monitored']), showIf: ({ values }) => values.occupancy !== 'Job sites only (no premises)' },
  ],
  coverages: [
    { key: 'glLimits', label: 'General Liability (Occurrence / Aggregate):*', type: 'select', scope: 'policy', required: true, default: '1000000/2000000', options: choices([['500000/1000000', '$500,000 / $1,000,000'], ['1000000/2000000', '$1,000,000 / $2,000,000'], ['2000000/4000000', '$2,000,000 / $4,000,000']]) },
    { key: 'productsOps', label: 'Products-Completed Operations Aggregate:', type: 'display', scope: 'policy', compute: ({ values }) => (values.glLimits ? `$${Number(values.glLimits.split('/')[1]).toLocaleString('en-US')} (included)` : '—') },
    { key: 'deductible', label: 'Property Deductible:*', type: 'select', scope: 'policy', required: true, default: '1000', options: choices([['500', '$500'], ['1000', '$1,000'], ['2500', '$2,500'], ['5000', '$5,000']]) },
    { key: 'businessIncome', label: 'Business Income & Extra Expense:*', type: 'select', scope: 'policy', required: true, default: 'Included', options: choices([['Included', '12 months actual loss sustained (included with BOP)'], ['None', 'None']]) },
    { key: 'equipmentBreakdown', label: 'Equipment Breakdown:*', type: 'select', scope: 'policy', required: true, default: 'No', options: choices([['No', 'No', 0], ['Yes', 'Yes', 90]]) },
    { key: 'hnoa', label: 'Hired & Non-Owned Auto Liability:*', type: 'select', scope: 'policy', required: true, default: 'No', options: choices([['No', 'No', 0], ['Yes', 'Yes', 120]]) },
    { key: 'tools', label: "Contractor's Tools & Equipment:*", type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['10000', '$10,000', 180], ['25000', '$25,000', 350], ['50000', '$50,000', 600]]), help: 'Inland marine coverage for tools and equipment that travel to job sites.' },
    { key: 'dishonesty', label: 'Employee Dishonesty:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['10000', '$10,000', 60], ['25000', '$25,000', 110]]) },
  ],
  questions: [
    { key: 'form', label: 'Coverage Form:*', type: 'select', required: true, options: choices(['Businessowners Policy (BOP)', 'Contractor General Liability (GL only)']), help: 'A BOP packages property and liability for eligible retail, office, restaurant and nonprofit classes. Contractors are written on the GL form.' },
    // Contractors section (ACORD 126)
    { key: 'subcontracted', label: 'Percentage of work subcontracted to others:*', type: 'select', required: true, options: choices(['None', '1% - 25%', '26% - 50%', 'More than 50%']), ineligibleIf: 'More than 50%', ineligibleMessage: 'Businesses that subcontract more than 50% of their work are not eligible.', showIf: ({ business }) => isContractor(business) },
    { key: 'certificates', label: 'Does the business obtain certificates of insurance from all subcontractors?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES, showIf: ({ business, values }) => isContractor(business) && !!values.subcontracted && values.subcontracted !== 'None' },
    { key: 'subLimits', label: 'Do subcontractors carry General Liability limits equal to or greater than the business\'s own?*', type: 'select', required: true, options: YES_NO_CHOICES, showIf: ({ business, values }) => isContractor(business) && !!values.subcontracted && values.subcontracted !== 'None' },
    { key: 'subAdditionalInsured', label: 'Is the business named as an additional insured on subcontractors\' policies?*', type: 'select', required: true, options: YES_NO_CHOICES, showIf: ({ business, values }) => isContractor(business) && !!values.subcontracted && values.subcontracted !== 'None' },
    { key: 'residentialPct', label: 'Share of work that is residential:*', type: 'select', required: true, options: choices(['None', '1% - 50%', '51% - 100%']), showIf: ({ business }) => isContractor(business) },
    { key: 'newResidential', label: 'Any work on new tract homes, condominiums or townhouse developments?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'New residential tract, condominium and townhouse work (construction defect exposure) is not eligible.', showIf: ({ business }) => isContractor(business) },
    { key: 'excavation', label: 'Does any work involve excavation, tunneling, underground work or blasting?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Excavation, tunneling, underground and blasting work is not eligible.', showIf: ({ business }) => isContractor(business) },
    { key: 'heights', label: 'Does any work involve roofing or heights above three stories?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Roofing and work above three stories are not eligible for this program.', showIf: ({ business }) => isContractor(business) },
    { key: 'designs', label: 'Does the business draw plans, designs or specifications for others?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Design work is a professional exposure excluded from General Liability.', showIf: ({ business }) => isContractor(business) },
    // Food and alcohol
    { key: 'alcohol', label: 'Do alcohol sales exceed 25% of revenue?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Businesses with more than 25% alcohol sales need liquor liability and are not eligible.', showIf: ({ business }) => servesFood(business) },
    { key: 'hood', label: 'Is there commercial cooking with an automatic hood suppression system (UL 300)?*', type: 'select', required: true, options: choices(['No commercial cooking', 'Yes, with UL 300 system', 'Yes, without suppression']), ineligibleIf: 'Yes, without suppression', ineligibleMessage: 'Commercial cooking requires a UL 300 hood suppression system serviced every 6 months.', showIf: ({ business }) => servesFood(business) },
    // Products / premises (ACORD 126 general information)
    { key: 'ownLabel', label: 'Does the business make, or sell under its own label, any products?*', type: 'select', required: true, options: YES_NO_CHOICES, showIf: ({ business }) => !isContractor(business) },
    { key: 'recalls', label: 'Any products recalled, discontinued or changed in the past 5 years?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Product recalls must be referred to underwriting.', showIf: ({ business, values }) => !isContractor(business) && values.ownLabel === 'Yes' },
    { key: 'hazardousOps', label: 'Any past, present or discontinued operations involving storing, treating, discharging or transporting hazardous material?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Hazardous material operations (pollution exposure) are not eligible.' },
    { key: 'acquired', label: 'Any operations sold, acquired or discontinued in the past 5 years?*', type: 'select', required: true, options: YES_NO_CHOICES },
    { key: 'rentsEquipment', label: 'Is machinery or equipment loaned or rented to others?*', type: 'select', required: true, options: YES_NO_CHOICES },
    { key: 'leasedEmployees', label: 'Does the business lease employees to or from other employers?*', type: 'select', required: true, options: YES_NO_CHOICES },
    { key: 'recreation', label: 'Is there a swimming pool, playground or recreational facility on the premises?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Pools, playgrounds and recreational facilities need underwriting review.' },
    { key: 'events', label: 'Does the business sponsor social or sporting events?*', type: 'select', required: true, options: YES_NO_CHOICES },
    { key: 'crime', label: 'Have any crimes occurred or been attempted on the premises in the past 3 years?*', type: 'select', required: true, options: YES_NO_CHOICES },
  ],
  unitRules: (values): Record<string, string> => {
    const year = Number(values.yearBuilt);
    return values.yearBuilt && (year < 1850 || year > new Date().getFullYear()) ? { yearBuilt: 'Enter a valid four-digit year built.' } : {};
  },
  describe: (unit) => [unit.values.street, unit.values.city].filter(Boolean).join(', ') || unit.values.occupancy || 'New Location',
  rate(ctx, quote): ProductRateResult {
    const commercial = ctx.commercial;
    const industry = industryOf(ctx);
    const certificates = quote.answers.certificates === 'Yes';
    const subs = industry.contractor && !!quote.answers.subcontracted && quote.answers.subcontracted !== 'None';
    const discounts = commonDiscounts(ctx, [[certificates && subs, 'Subcontractor Certificates', 0.95]]);
    const uninsuredSubs = subs && !certificates ? money(commercial?.business.subcontractCost ?? '') : 0;
    const isBop = quote.answers.form !== 'Contractor General Liability (GL only)';
    const revenue = money(commercial?.business.revenue ?? '') || 250000;
    const payroll = money(commercial?.business.payroll ?? '') || 100000;
    // ISO exposure bases: contractors per $1,000 of payroll, mercantile and service per $1,000 of gross sales.
    const payrollBasis = industry.contractor && !!industry.glPayroll;
    const glExposure = payrollBasis ? (payroll + uninsuredSubs) / 1000 * (industry.glPayroll ?? 0) : revenue / 1000 * industry.gl;
    const limit = factor({ '500000/1000000': 0.85, '1000000/2000000': 1, '2000000/4000000': 1.35 }, quote.coverages.glLimits);
    const load = (commercial?.yearsFactor ?? 1) * (commercial?.lossFactor ?? 1);
    const ded = factor({ '500': 1.05, '1000': 1, '2500': 0.9, '5000': 0.82 }, quote.coverages.deductible);
    const def = (key: string) => bop.coverages.find((entry) => entry.key === key);
    const units = quote.units.map((unit, index): UnitPremium => {
      const v = unit.values;
      const premises = v.occupancy !== 'Job sites only (no premises)';
      const construction = factor({ Frame: 1.25, 'Joisted Masonry': 1.05, 'Masonry Non-Combustible': 0.9, 'Fire Resistive': 0.8 }, v.construction);
      const protection = (v.sprinklered === 'Yes' ? 0.8 : 1) * factor({ 'Local Alarm': 0.95, 'Central Station Monitored': 0.9 }, v.alarm);
      const age = Number(v.yearBuilt) && Number(v.yearBuilt) < 1960 ? 1.2 : 1;
      const insuredValue = (v.occupancy === 'Own building' ? money(v.buildingValue) : 0) + (premises ? money(v.bppValue) : 0);
      const territory = ctx.territory(v.garagingZip ?? '');
      const amounts: Record<string, number> = {
        glLimits: index === 0 ? Math.max(400, glExposure) * limit * load * territory * discounts.factor : 0,
        property: isBop && premises ? insuredValue / 100 * 0.28 * construction * protection * ded * age * territory * discounts.factor : 0,
        equipmentBreakdown: isBop && premises ? baseOf(def('equipmentBreakdown'), quote.coverages.equipmentBreakdown) : 0,
        hnoa: index === 0 ? baseOf(def('hnoa'), quote.coverages.hnoa) : 0,
        tools: index === 0 ? baseOf(def('tools'), quote.coverages.tools) * load : 0,
        dishonesty: index === 0 ? baseOf(def('dishonesty'), quote.coverages.dishonesty) : 0,
      };
      const rounded = Object.fromEntries(Object.entries(amounts).map(([key, amount]) => [key, round2(amount)]));
      return { unitId: unit.id, label: bop.describe(unit), amounts: rounded, total: totalOf(rounded) };
    });
    return { units, policy: {}, discounts: discounts.names, factors: [{ label: 'Coverage form', value: isBop ? 'Businessowners Policy' : 'Contractor General Liability' }, { label: payrollBasis ? 'Exposure basis (payroll)' : 'Exposure basis (gross sales)', value: payrollBasis ? `$${payroll.toLocaleString('en-US')} × ${industry.glPayroll} per $1,000` : `$${revenue.toLocaleString('en-US')} × ${industry.gl} per $1,000` }, ...baseFactors(ctx), ...discounts.factors] };
  },
};

// ------------------------------------------------------------------ Management Liability (EPLI / NPDO / Cyber)

const mgmt: ProductConfig = {
  key: 'mgmt', tileLabel: 'EPLI, NPDO, CYBER AND MORE', tabLabel: 'EPLI/NPDO/CYBER', name: 'Management Liability (EPLI/NPDO/Cyber)', unitLabel: 'Organization', unitPlural: 'Organizations', multiUnit: false, maxUnits: 1, termMonths: 12, motorized: false, usesMvr: false, minimumPremium: 750,
  unitFields: [
    { key: 'fullTime', label: 'Full-Time Employees:*', type: 'digits', required: true, tag: true },
    { key: 'partTime', label: 'Part-Time Employees:*', type: 'digits', required: true },
    { key: 'turnover', label: 'Annual Employee Turnover:*', type: 'select', required: true, tag: true, options: choices(['Less than 10%', '10% - 25%', 'More than 25%']) },
    { key: 'records', label: 'Personal Records Stored:*', type: 'select', required: true, tag: true, options: choices(['Fewer than 10,000', '10,000 - 100,000', 'More than 100,000']), help: 'Customer or employee records with names plus SSNs, card numbers, health or financial information.' },
    { key: 'cards', label: 'Accepts Credit Card Payments?*', type: 'select', required: true, options: YES_NO_CHOICES },
    { key: 'garagingZip', label: 'Headquarters ZIP Code:*', type: 'zip', required: true },
  ],
  coverages: [
    { key: 'epli', label: 'Employment Practices Liability:*', type: 'select', scope: 'policy', required: true, default: '250000', options: choices([['No', 'Not selected'], ['250000', '$250,000'], ['500000', '$500,000'], ['1000000', '$1,000,000']]), help: 'Covers claims of wrongful termination, discrimination, harassment and retaliation by employees.' },
    { key: 'epliRetention', label: 'EPLI Retention:*', type: 'select', scope: 'policy', required: true, default: '5000', options: choices([['2500', '$2,500'], ['5000', '$5,000'], ['10000', '$10,000']]) },
    { key: 'npdo', label: 'Nonprofit Directors & Officers:*', type: 'select', scope: 'policy', required: true, default: 'No', options: choices([['No', 'Not selected'], ['500000', '$500,000'], ['1000000', '$1,000,000']]), help: 'Available only to nonprofit organizations. Protects directors and officers from claims about their management decisions.' },
    { key: 'cyber', label: 'Cyber Liability:*', type: 'select', scope: 'policy', required: true, default: 'No', options: choices([['No', 'Not selected'], ['100000', '$100,000'], ['250000', '$250,000'], ['500000', '$500,000'], ['1000000', '$1,000,000']]), help: 'Breach response, ransomware, data restoration and network security liability.' },
    { key: 'cyberRetention', label: 'Cyber Retention:*', type: 'select', scope: 'policy', required: true, default: '2500', options: choices([['1000', '$1,000'], ['2500', '$2,500'], ['5000', '$5,000']]) },
  ],
  questions: [
    { key: 'handbook', label: 'Does the business have a written employee handbook with an anti-harassment policy?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'priorEpl', label: 'Employment-related claims or EEOC charges in the past 5 years:*', type: 'select', required: true, options: choices(['0', '1', '2 or more']), ineligibleIf: '2 or more', ineligibleMessage: 'Two or more employment claims in 5 years require underwriting referral.' },
    { key: 'mfa', label: 'Is multi-factor authentication required for email and remote access?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Cyber Liability requires MFA on email and remote access.' },
    { key: 'backups', label: 'Are critical systems backed up at least weekly to an offline or cloud location?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'hr', label: 'Does the business have a human resources department or an outsourced HR provider (PEO)?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'layoffs', label: 'Any layoffs, closures or reductions in force in the past 12 months or planned in the next 12?*', type: 'select', required: true, options: YES_NO_CHOICES },
    { key: 'contractors1099', label: 'Independent contractors (1099) used:*', type: 'select', required: true, options: choices(['None', '1 - 5', '6 or more']), help: 'Misclassified contractors can bring wage-and-hour and discrimination claims.' },
    { key: 'phishing', label: 'Do employees complete security-awareness (phishing) training at least annually?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'edr', label: 'Is endpoint detection and response (EDR) or managed antivirus on every computer?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'pci', label: 'If the business accepts cards, is it PCI-DSS compliant?*', type: 'select', required: true, options: choices(['Yes', 'No', 'Does not accept cards']) },
    { key: 'cyberIncident', label: 'Any data breach, ransomware or other cyber incident in the past 3 years?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'A cyber incident in the past 3 years must be referred to underwriting.' },
  ],
  describe: (unit) => unit.values.fullTime ? `${Number(unit.values.fullTime || 0) + Number(unit.values.partTime || 0)} employees` : 'Organization',
  rate(ctx, quote): ProductRateResult {
    const commercial = ctx.commercial;
    const industry = industryOf(ctx);
    const c = quote.coverages;
    const a = quote.answers;
    const discounts = commonDiscounts(ctx);
    const revenue = money(commercial?.business.revenue ?? '') || 250000;
    const load = commercial?.lossFactor ?? 1;
    const units = quote.units.map((unit): UnitPremium => {
      const v = unit.values;
      const employees = Number(v.fullTime || 0) + Number(v.partTime || 0) * 0.5;
      const epliBase = band(employees, [[10, 900], [25, 1350], [50, 2100], [100, 3200]], 4800);
      const epli = c.epli === 'No' ? 0 : epliBase * factor({ '250000': 1, '500000': 1.3, '1000000': 1.6 }, c.epli) * factor({ '2500': 1.1, '5000': 1, '10000': 0.9 }, c.epliRetention) * factor({ 'Less than 10%': 1, '10% - 25%': 1.15, 'More than 25%': 1.35 }, v.turnover) * industry.epl * (a.priorEpl === '1' ? 1.4 : 1) * (a.handbook === 'Yes' ? 0.9 : 1) * (a.hr === 'Yes' ? 0.92 : 1) * (a.layoffs === 'Yes' ? 1.25 : 1) * (a.contractors1099 === '6 or more' ? 1.1 : 1) * load * discounts.factor;
      const npdo = c.npdo === 'No' ? 0 : Math.max(750, revenue / 1000 * 0.9) * factor({ '500000': 1, '1000000': 1.35 }, c.npdo) * load * discounts.factor;
      const records = factor({ 'Fewer than 10,000': 250, '10,000 - 100,000': 600, 'More than 100,000': 1400 }, v.records, 250);
      const cyber = c.cyber === 'No' ? 0 : (clamp(revenue / 1000 * 0.55, 300, 20000) + records) * factor({ '100000': 0.6, '250000': 1, '500000': 1.5, '1000000': 2.2 }, c.cyber) * factor({ '1000': 1.1, '2500': 1, '5000': 0.92 }, c.cyberRetention) * (a.backups === 'Yes' ? 0.9 : 1) * (a.phishing === 'Yes' ? 0.95 : 1) * (a.edr === 'Yes' ? 0.93 : 1) * (v.cards === 'Yes' ? (a.pci === 'No' ? 1.35 : 1.15) : 1) * discounts.factor;
      const amounts = { epli: round2(epli), npdo: round2(npdo), cyber: round2(cyber) };
      return { unitId: unit.id, label: mgmt.describe(unit), amounts, total: totalOf(amounts) };
    });
    return { units, policy: {}, discounts: [...discounts.names, ...(a.handbook === 'Yes' ? ['Employee Handbook'] : []), ...(a.backups === 'Yes' ? ['Data Backups'] : [])], factors: [...baseFactors(ctx), ...discounts.factors] };
  },
};

// ------------------------------------------------------------------ Trucking (for-hire motor carrier)

const COMMODITIES: Record<string, number> = { 'General freight (dry van)': 1, 'Refrigerated (reefer)': 1.12, 'Flatbed / building materials': 1.15, 'Intermodal containers': 1.1, 'Household goods (moving)': 1.25, 'Hazardous materials (placarded)': 0 };
export const HOUSEHOLD_GOODS = 'Household goods (moving)';

const trucking: ProductConfig = {
  key: 'trucking', tileLabel: 'TRUCKING', tabLabel: 'TRUCKING', name: 'Trucking (For-Hire)', unitLabel: 'Power Unit/Trailer', unitPlural: 'Power Units & Trailers', multiUnit: true, maxUnits: 10, termMonths: 12, motorized: true, usesMvr: true, idField: 'vin', minimumPremium: 3500,
  unitFields: [
    { key: 'type', label: 'Unit Type:*', type: 'select', required: true, options: choices(['Tractor (Semi)', 'Straight Truck', 'Dry Van Trailer', 'Refrigerated Trailer', 'Flatbed Trailer']), help: 'Power units (tractors, straight trucks) carry liability; trailers are rated for physical damage and a small liability charge.' },
    { key: 'vin', label: 'VIN:', type: 'vin', posRequired: true, help: 'Required before binding. A 17-character VIN (no I, O or Q).' },
    { key: 'year', label: 'Year:*', type: 'select', required: true, options: YEAR_CHOICES },
    { key: 'make', label: 'Make:*', type: 'select', required: true, options: choices(['Freightliner', 'Peterbilt', 'Kenworth', 'Volvo', 'International', 'Mack', 'Great Dane', 'Utility', 'Wabash', 'Other']) },
    { key: 'model', label: 'Model:*', type: 'text', required: true },
    { key: 'gvw', label: 'Gross Vehicle Weight (GVW):*', type: 'select', required: true, options: choices(['26,001 - 33,000 lbs', '33,001 - 80,000 lbs']), help: 'Combination weight for a tractor and trailer. Over 26,000 lbs requires a CDL.' },
    { key: 'radius', label: 'Radius of Operation:*', type: 'select', required: true, tag: true, options: choices(['0 - 100 miles (local)', '101 - 300 miles (regional)', 'Over 300 miles (long haul)']) },
    { key: 'value', label: 'Stated Amount (Unit Value):*', type: 'money', required: true, tag: true },
    { key: 'garagingZip', label: 'Garaging / Terminal ZIP Code:*', type: 'zip', required: true },
  ],
  coverages: [
    { key: 'liability', label: 'Auto Liability (Combined Single Limit):*', type: 'select', scope: 'policy', required: true, default: '1000000', options: choices([['750000', '$750,000 CSL (federal minimum, general freight)', 4300], ['1000000', '$1,000,000 CSL', 4800]]), help: '49 CFR 387.9: for-hire carriers of non-hazardous property over 10,000 lbs GVWR in interstate commerce must carry at least $750,000. Most shippers and brokers require $1,000,000. An MCS-90 endorsement is attached and the insurer files a BMC-91 with FMCSA.' },
    { key: 'um', label: 'Uninsured/Underinsured Motorist (CSL):*', type: 'select', scope: 'policy', required: true, default: '300000', options: choices([['300000', '$300,000', 90], ['1000000', '$1,000,000', 160]]) },
    { key: 'cargo', label: 'Motor Truck Cargo:*', type: 'select', scope: 'policy', required: true, default: '100000', options: choices([['None', 'None', 0], ['50000', '$50,000', 750], ['100000', '$100,000', 1100], ['250000', '$250,000', 1900]]), help: 'Covers the customer freight being hauled. Not federally required for general freight, but most brokers require $100,000. Household goods carriers must file cargo insurance (BMC-34).' },
    { key: 'cargoDeductible', label: 'Cargo Deductible:*', type: 'select', scope: 'policy', required: true, default: '2500', options: choices([['1000', '$1,000'], ['2500', '$2,500'], ['5000', '$5,000']]) },
    { key: 'interchange', label: 'Trailer Interchange:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['30000', '$30,000', 350], ['50000', '$50,000', 520]]), help: 'Physical damage to non-owned trailers hauled under a trailer interchange agreement.' },
    deductible('comp', 'Comprehensive Deductible:*'),
    deductible('coll', 'Collision Deductible:*'),
  ],
  questions: [
    { key: 'authority', label: 'Operating authority:*', type: 'select', required: true, options: choices(['Own MC authority (for-hire)', 'Leased on to another motor carrier']), help: 'Carriers leased on to another motor carrier use that carrier\'s authority and liability; they need physical damage and non-trucking liability instead.' },
    { key: 'operation', label: 'Operation:*', type: 'select', required: true, options: choices(['Interstate (crosses state lines)', 'Intrastate only']), help: 'Interstate for-hire carriers need a USDOT number, MC operating authority and the federal financial responsibility filing.' },
    { key: 'usdot', label: 'USDOT Number:*', type: 'digits', required: true, help: 'Required for interstate carriers and, in most states (including NC), for intrastate commercial vehicles over 26,000 lbs.' },
    { key: 'mc', label: 'MC Number:*', type: 'digits', required: true, showIf: ({ values }) => values.authority === 'Own MC authority (for-hire)' && values.operation !== 'Intrastate only', help: 'Interstate for-hire operating authority issued by FMCSA.' },
    { key: 'commodity', label: 'Primary commodity hauled:*', type: 'select', required: true, options: choices(Object.keys(COMMODITIES)), ineligibleIf: 'Hazardous materials (placarded)', ineligibleMessage: 'Placarded hazardous materials carriers are not eligible for this trucking program.' },
    { key: 'authorityYears', label: 'Years operating under current authority:*', type: 'select', required: true, tag: true, options: choices(['New authority (less than 1 year)', '1 to 2 years', '3 years or more']) },
    { key: 'eld', label: 'Are all power units equipped with electronic logging devices (ELD)?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'No', ineligibleMessage: 'Interstate carriers must use ELDs to record hours of service.' },
    { key: 'csaAlerts', label: 'Any FMCSA CSA BASIC scores above the intervention threshold?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'A BASIC alert (for example Unsafe Driving or Hours-of-Service) signals higher risk.' },
    { key: 'safetyRating', label: 'FMCSA safety rating:*', type: 'select', required: true, tag: true, options: choices(['Satisfactory', 'Not rated', 'Conditional', 'Unsatisfactory']), ineligibleIf: 'Unsatisfactory', ineligibleMessage: 'Carriers with an Unsatisfactory safety rating are prohibited from operating (49 CFR 385.13).' },
    { key: 'drugTesting', label: 'Is the carrier enrolled in a DOT drug and alcohol testing program and the FMCSA Clearinghouse (49 CFR Part 382)?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'No', ineligibleMessage: 'Every CDL driver must be in a DOT drug and alcohol testing program and queried in the Clearinghouse.' },
    { key: 'screening', label: 'Are MVR and PSP (Pre-Employment Screening Program) reports pulled on every driver before hire?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'turnover', label: 'Drivers who left the company in the past 12 months:*', type: 'select', required: true, options: choices(['0 - 1', '2 - 5', 'More than 5']) },
    { key: 'ownerOperators', label: 'Does the carrier lease on owner-operators (drivers with their own trucks)?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Owner-operator units must be scheduled and the lease must meet 49 CFR Part 376.', showIf: ({ values }) => values.authority === 'Own MC authority (for-hire)' },
    { key: 'broker', label: 'Does the business also broker freight or arrange loads for other carriers?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Brokerage needs separate broker authority and contingent cargo / contingent auto liability.' },
    { key: 'priorAuthority', label: 'Has the owner operated under a different name, USDOT or MC number in the past 5 years?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Prior authorities must be disclosed and reviewed by underwriting.' },
    { key: 'area', label: 'Area of operation:*', type: 'select', required: true, options: choices(['Home state only', 'Neighboring states', 'East of the Rocky Mountains', 'All 48 states']) },
  ],
  unitRules: (values): Record<string, string> => {
    const errors: Record<string, string> = {};
    const year = Number(values.year);
    if (values.type === 'Tractor (Semi)' && values.gvw === '26,001 - 33,000 lbs') errors.gvw = 'A tractor-trailer combination is rated at 33,001 - 80,000 lbs.';
    if (values.type && values.type.includes('Trailer') && values.radius && !values.gvw) errors.gvw = 'Select the combination weight the trailer is pulled at.';
    if (year && new Date().getFullYear() - year > 20 && !values.type?.includes('Trailer')) errors.year = 'Power units more than 20 years old are not eligible.';
    return errors;
  },
  describe: describeVehicle,
  rate(ctx, quote): ProductRateResult {
    const commercial = ctx.commercial;
    const a = quote.answers;
    const def = (key: string) => trucking.coverages.find((entry) => entry.key === key);
    const load = (commercial?.yearsFactor ?? 1) * (commercial?.lossFactor ?? 1);
    const drivers = commercial?.driverFactor ?? 1;
    const authority = factor({ 'New authority (less than 1 year)': 1.45, '1 to 2 years': 1.15, '3 years or more': 1 }, a.authorityYears);
    const commodity = factor(COMMODITIES, a.commodity) || 1;
    const csa = (a.csaAlerts === 'Yes' ? 1.3 : 1) * (a.safetyRating === 'Conditional' ? 1.25 : 1) * (a.screening === 'Yes' ? 0.95 : 1) * factor({ '0 - 1': 1, '2 - 5': 1.05, 'More than 5': 1.15 }, a.turnover);
    const leased = a.authority === 'Leased on to another motor carrier';
    const powerUnits = quote.units.filter((unit) => !unit.values.type?.includes('Trailer')).length || 1;
    const units = quote.units.map((unit, index): UnitPremium => {
      const v = unit.values;
      const trailer = !!v.type?.includes('Trailer');
      const radius = factor({ '0 - 100 miles (local)': 1, '101 - 300 miles (regional)': 1.2, 'Over 300 miles (long haul)': 1.45 }, v.radius);
      const weight = v.gvw === '33,001 - 80,000 lbs' ? 1.15 : 1;
      const territory = ctx.territory(v.garagingZip ?? '');
      const value = money(v.value) || (trailer ? 30000 : 90000);
      const dedFactor = (ded: string) => factor({ '500': 1.15, '1000': 1, '2500': 0.85 }, ded, 0);
      const people = drivers * load * authority * csa;
      // Leased-on carriers ride on the motor carrier's liability: non-trucking liability is about 10%.
      const liability = trailer ? 150 : baseOf(def('liability'), quote.coverages.liability) * radius * weight * commodity * territory * people * (leased ? 0.1 : 1);
      const amounts: Record<string, number> = {
        liability,
        um: trailer ? 0 : baseOf(def('um'), quote.coverages.um),
        comp: value * 0.008 * dedFactor(unit.coverages.comp) * territory,
        coll: value * (trailer ? 0.015 : 0.02) * dedFactor(unit.coverages.coll) * radius * (trailer ? 1 : people),
        cargo: index === 0 ? baseOf(def('cargo'), quote.coverages.cargo) * powerUnits * commodity * factor({ '1000': 1.1, '2500': 1, '5000': 0.9 }, quote.coverages.cargoDeductible) * load : 0,
        interchange: index === 0 ? baseOf(def('interchange'), quote.coverages.interchange) : 0,
        filing: index === 0 && !leased && a.operation !== 'Intrastate only' ? 100 : 0,
      };
      const rounded = Object.fromEntries(Object.entries(amounts).map(([key, amount]) => [key, round2(amount)]));
      return { unitId: unit.id, label: describeVehicle(unit), amounts: rounded, total: totalOf(rounded) };
    });
    return { units, policy: {}, discounts: [], factors: [...baseFactors(ctx), { label: 'Driver schedule', value: pct(drivers) }, { label: 'Authority age', value: pct(authority) }, { label: `Commodity (${a.commodity || '—'})`, value: pct(commodity) }, ...(csa > 1 ? [{ label: 'CSA BASIC alert', value: pct(csa) }] : []), ...(leased ? [{ label: 'Leased on: non-trucking liability', value: '−90%' }] : [])] };
  },
};

// ------------------------------------------------------------------ Commercial Property

/** Base building rate per $100 by occupancy (before construction, protection and other factors). */
const OCCUPANCY_RATES: Record<string, number> = { 'Office': 0.27, 'Retail store': 0.38, 'Warehouse / storage': 0.34, 'Light manufacturing': 0.52, 'Restaurant': 0.72, 'Apartment building (5+ units)': 0.42 };
/** Typical replacement cost per square foot by occupancy (insurance-to-value check). */
const COST_PER_SQFT: Record<string, number> = { 'Office': 190, 'Retail store': 150, 'Warehouse / storage': 95, 'Light manufacturing': 120, 'Restaurant': 260, 'Apartment building (5+ units)': 175 };
const ISO_CONSTRUCTION: Record<string, number> = { 'Frame (ISO 1)': 1.3, 'Joisted Masonry (ISO 2)': 1.1, 'Non-Combustible (ISO 3)': 0.95, 'Masonry Non-Combustible (ISO 4)': 0.88, 'Modified Fire Resistive (ISO 5)': 0.8, 'Fire Resistive (ISO 6)': 0.75 };
const PROTECTION_CLASS: Record<string, number> = { '1': 0.85, '2': 0.88, '3': 0.9, '4': 0.95, '5': 1, '6': 1.03, '7': 1.1, '8': 1.2, '8B': 1.25, '9': 1.4, '10': 1.6 };
const estimateOf = (values: Record<string, string>) => (Number(values.squareFeet) || 0) * (COST_PER_SQFT[values.occupancy] ?? 150) * (ISO_CONSTRUCTION[values.construction] && ISO_CONSTRUCTION[values.construction] < 0.9 ? 1.1 : 1);

const property: ProductConfig = {
  key: 'property', tileLabel: 'COMMERCIAL PROPERTY', tabLabel: 'COMMERCIAL PROPERTY', name: 'Commercial Property', unitLabel: 'Building', unitPlural: 'Buildings', multiUnit: true, maxUnits: 5, termMonths: 12, motorized: false, usesMvr: false, minimumPremium: 750,
  unitFields: [
    { key: 'street', label: 'Building Street Address:*', type: 'text', required: true },
    { key: 'city', label: 'City:*', type: 'text', required: true },
    { key: 'garagingZip', label: 'ZIP Code:*', type: 'zip', required: true },
    { key: 'occupancy', label: 'Building Occupancy:*', type: 'select', required: true, options: choices(Object.keys(OCCUPANCY_RATES)), help: 'What the building is used for drives the base rate: restaurants and manufacturing burn more often than offices.' },
    { key: 'construction', label: 'Construction (ISO class):*', type: 'select', required: true, tag: true, options: choices(Object.keys(ISO_CONSTRUCTION)), help: 'ISO classes 1-6, from least to most fire resistive. Fire resistive (6) has walls, floors and roof rated 2 hours or more; modified fire resistive (5) 1 to 2 hours.' },
    { key: 'yearBuilt', label: 'Year Built:*', type: 'digits', required: true },
    { key: 'squareFeet', label: 'Square Footage:*', type: 'digits', required: true },
    { key: 'stories', label: 'Number of Stories:*', type: 'digits', required: true },
    { key: 'interest', label: 'Applicant\'s Interest:*', type: 'select', required: true, options: choices(['Owner', 'Tenant']), help: 'Tenants insure their contents and improvements; the building limit applies only when the lease makes the tenant responsible for the building.' },
    { key: 'occupiedPct', label: '% of Building Occupied by the Applicant:*', type: 'select', required: true, options: choices(['100%', '51% - 99%', '1% - 50%', 'None (lessor\'s risk only)']) },
    { key: 'roofType', label: 'Roof Covering:*', type: 'select', required: true, options: choices(['Built-up / modified bitumen', 'Single-ply membrane (TPO/EPDM)', 'Metal', 'Asphalt shingle', 'Tile / slate', 'Wood shake']) },
    { key: 'roofYear', label: 'Roof Replaced (year):*', type: 'digits', required: true, divider: true },
    { key: 'wiringYear', label: 'Wiring Updated (year):*', type: 'digits', required: true },
    { key: 'plumbingYear', label: 'Plumbing Updated (year):*', type: 'digits', required: true },
    { key: 'heatingYear', label: 'Heating/HVAC Updated (year):*', type: 'digits', required: true },
    { key: 'floodZone', label: 'FEMA Flood Zone:*', type: 'select', required: true, options: choices(['X (minimal risk)', 'A or AE (special flood hazard)', 'V or VE (coastal high hazard)']), help: 'Flood is excluded from commercial property. Buildings in A or V zones with a federally backed mortgage must carry flood insurance (NFIP or private).' },
    { key: 'sprinklered', label: 'Automatic Sprinklers (100%):*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'protectionClass', label: 'Public Protection Class (ISO PPC 1-10):*', type: 'select', required: true, options: choices(Object.keys(PROTECTION_CLASS)), help: 'ISO Public Protection Class of the fire district: 1 is the best protection, 10 is unprotected. 8B is a split class for well-protected areas outside hydrant range.' },
    { key: 'alarm', label: 'Burglar Alarm:*', type: 'select', required: true, tag: true, options: choices(['None', 'Local Alarm', 'Central Station Monitored']) },
    { key: 'estimate', label: 'Estimated Replacement Cost:', type: 'display', compute: ({ values }) => (estimateOf(values) ? `$${Math.round(estimateOf(values)).toLocaleString('en-US')} (${values.squareFeet} sq ft x typical cost for ${values.occupancy || 'this occupancy'})` : 'Enter occupancy, construction and square footage') },
    { key: 'buildingValue', label: 'Building Limit (Replacement Cost):*', type: 'money', required: true, help: 'Enter 0 if the business leases the space and insures only its contents. Insure to at least the coinsurance percentage of replacement cost or losses are paid in proportion.' },
    { key: 'bppValue', label: 'Business Personal Property Limit:*', type: 'money', required: true },
    { key: 'biLimit', label: 'Business Income & Extra Expense Limit:*', type: 'money', required: true, help: '12 months of net income plus continuing expenses. Enter 0 for none.' },
  ],
  coverages: [
    { key: 'causes', label: 'Causes of Loss Form:*', type: 'select', scope: 'policy', required: true, default: 'Special', options: choices([['Basic', 'Basic (named perils)'], ['Broad', 'Broad'], ['Special', 'Special (open perils)']]) },
    { key: 'valuation', label: 'Valuation:*', type: 'select', scope: 'policy', required: true, default: 'Replacement Cost', options: choices(['Replacement Cost', 'Actual Cash Value']) },
    { key: 'coinsurance', label: 'Coinsurance:*', type: 'select', scope: 'policy', required: true, default: '80', options: choices([['80', '80%'], ['90', '90%'], ['100', '100%'], ['Agreed', 'Agreed Value (coinsurance waived)']]), help: 'Limits must be at least this percentage of the property value or losses are paid in proportion: payment = loss x (limit carried / limit required). A higher percentage earns a lower rate. Agreed Value waives coinsurance for the policy term when a signed statement of values is on file.' },
    { key: 'deductible', label: 'Property Deductible:*', type: 'select', scope: 'policy', required: true, default: '1000', options: choices([['500', '$500'], ['1000', '$1,000'], ['2500', '$2,500'], ['5000', '$5,000'], ['10000', '$10,000']]) },
    { key: 'windDeductible', label: 'Wind/Hail Deductible:*', type: 'select', scope: 'policy', required: true, default: 'Same', options: choices([['Same', 'Same as property deductible'], ['1', '1% of building value'], ['2', '2% of building value'], ['5', '5% of building value']]) },
    { key: 'equipmentBreakdown', label: 'Equipment Breakdown:*', type: 'select', scope: 'policy', required: true, default: 'No', options: choices([['No', 'No', 0], ['Yes', 'Yes', 0]]), help: 'Mechanical and electrical breakdown of boilers, HVAC and equipment.' },
  ],
  questions: [
    { key: 'vacancy', label: 'Is any building more than 25% vacant?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Buildings more than 25% vacant need a vacancy permit and are not eligible.' },
    { key: 'knobTube', label: 'Any knob-and-tube wiring, aluminum branch wiring or screw-in fuses?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Knob-and-tube or aluminum branch wiring and fuse panels must be replaced before binding.' },
    { key: 'otherTenants', label: 'Do other tenants occupy the building (restaurants, auto repair, woodworking)?*', type: 'select', required: true, options: choices(['No other tenants', 'Office / retail tenants only', 'Restaurant, auto repair or woodworking tenant']), help: 'Hazardous neighboring tenants raise the fire rate for the whole building.' },
    { key: 'cooking', label: 'Is there commercial cooking with an automatic hood suppression system (UL 300)?*', type: 'select', required: true, options: choices(['No commercial cooking', 'Yes, with UL 300 system', 'Yes, without suppression']), ineligibleIf: 'Yes, without suppression', ineligibleMessage: 'Commercial cooking requires a UL 300 automatic hood suppression system.' },
  ],
  unitRules: (values): Record<string, string> => {
    const errors: Record<string, string> = {};
    const year = Number(values.yearBuilt);
    if (values.yearBuilt && (year < 1850 || year > new Date().getFullYear())) errors.yearBuilt = 'Enter a valid four-digit year built.';
    for (const [field, name] of [['roofYear', 'roof'], ['wiringYear', 'wiring'], ['plumbingYear', 'plumbing'], ['heatingYear', 'heating/HVAC']] as const) {
      const updated = Number(values[field]);
      if (values[field] && (updated > new Date().getFullYear() || (year && updated < year))) errors[field] = `The ${name} year must be between the year built and this year.`;
    }
    if (values.interest === 'Tenant' && values.occupiedPct === "None (lessor's risk only)") errors.occupiedPct = 'A tenant occupies at least part of the building.';
    if (values.buildingValue !== undefined && values.bppValue !== undefined && money(values.buildingValue) + money(values.bppValue) <= 0 && values.buildingValue !== '' && values.bppValue !== '') errors.bppValue = 'Insure the building, its contents, or both.';
    const estimate = estimateOf(values);
    const limit = money(values.buildingValue);
    if (limit > 0 && estimate && limit < estimate * 0.8) errors.buildingValue = `The building limit ($${limit.toLocaleString('en-US')}) is under 80% of the estimated replacement cost ($${Math.round(estimate).toLocaleString('en-US')}). Even at the lowest coinsurance (80%) a loss would be paid at only ${Math.round(limit / (estimate * 0.8) * 100)}%. Raise the limit or document the replacement cost.`;
    return errors;
  },
  describe: (unit) => [unit.values.street, unit.values.city].filter(Boolean).join(', ') || unit.values.occupancy || 'New Building',
  rate(ctx, quote): ProductRateResult {
    const commercial = ctx.commercial;
    const c = quote.coverages;
    const a = quote.answers;
    const load = (commercial?.yearsFactor ?? 1) * (commercial?.lossFactor ?? 1);
    const discounts = commonDiscounts(ctx);
    const form = factor({ Basic: 0.75, Broad: 0.88, Special: 1 }, c.causes);
    const valuation = c.valuation === 'Actual Cash Value' ? 0.9 : 1;
    const coins = factor({ '80': 1, '90': 0.95, '100': 0.9, Agreed: 1.05 }, c.coinsurance);
    const windDed = factor({ Same: 1, '1': 0.95, '2': 0.9, '5': 0.82 }, c.windDeductible);
    const ded = factor({ '500': 1.08, '1000': 1, '2500': 0.9, '5000': 0.82, '10000': 0.75 }, c.deductible);
    const units = quote.units.map((unit): UnitPremium => {
      const v = unit.values;
      const base = OCCUPANCY_RATES[v.occupancy] ?? 0.24;
      const construction = factor(ISO_CONSTRUCTION, v.construction);
      const protection = factor(PROTECTION_CLASS, v.protectionClass);
      const sprinkler = v.sprinklered === 'Yes' ? 0.7 : 1;
      const alarm = factor({ 'Local Alarm': 0.97, 'Central Station Monitored': 0.92 }, v.alarm);
      // Older buildings rate higher unless the major systems were updated in the past 25 years (ACORD 140 improvement years).
      const thisYear = new Date().getFullYear();
      const systemsUpdated = ['wiringYear', 'plumbingYear', 'heatingYear'].every((field) => Number(v[field]) && thisYear - Number(v[field]) <= 25);
      const age = Number(v.yearBuilt) && thisYear - Number(v.yearBuilt) > 50 ? (systemsUpdated ? 1.1 : 1.3) : 1;
      const roofAge = Number(v.roofYear) ? thisYear - Number(v.roofYear) : 0;
      const roof = (roofAge > 20 ? 1.15 : roofAge > 15 ? 1.07 : 1) * (v.roofType === 'Wood shake' ? 1.2 : 1);
      const tenants = a.otherTenants === 'Restaurant, auto repair or woodworking tenant' ? 1.2 : 1;
      const territory = ctx.territory(v.garagingZip ?? '');
      const rate = base * construction * protection * sprinkler * alarm * age * roof * tenants * form * valuation * coins * ded * windDed * territory * load * discounts.factor;
      const building = money(v.buildingValue) / 100 * rate;
      const contents = money(v.bppValue) / 100 * rate * 1.1;
      const income = money(v.biLimit) / 100 * rate * 0.6;
      const amounts: Record<string, number> = {
        building: round2(building),
        bpp: round2(contents),
        businessIncome: round2(income),
        equipmentBreakdown: c.equipmentBreakdown === 'Yes' ? round2((money(v.buildingValue) + money(v.bppValue)) / 100 * 0.018) : 0,
      };
      return { unitId: unit.id, label: property.describe(unit), amounts, total: totalOf(amounts) };
    });
    return { units, policy: {}, discounts: discounts.names, factors: [...baseFactors(ctx), { label: 'Causes of loss form', value: c.causes || '—' }, { label: `Coinsurance ${c.coinsurance || '—'}%`, value: pct(coins) }, ...discounts.factors] };
  },
};

export const COMMERCIAL_CONFIGS: Record<CommercialKey, ProductConfig> = { commercialAuto, trucking, bop, property, mgmt };
export const COMMERCIAL_PRODUCTS = Object.keys(COMMERCIAL_CONFIGS) as CommercialKey[];
