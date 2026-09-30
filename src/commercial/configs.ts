// Commercial Lines product definitions and business profile fields.
// Rates are annual training rates; factors follow common small-commercial practice.
import type { CommercialKey, CoverageDef, FieldDef, ProductConfig, ProductQuote, ProductRateResult, QuestionDef, RateContext, UnitPremium } from '@/products/types';
import { YEAR_CHOICES, YES_NO_CHOICES, band, baseOf, choices, clamp, factor, money, pct, round2 } from '@/products/helpers';
import { US_STATES } from '@/data/options';

export interface Industry { auto: number; gl: number; bop: boolean; epl: number; contractor: boolean }
export const INDUSTRIES: Record<string, Industry> = {
  'Artisan Contractor - Carpentry': { auto: 1.15, gl: 5.2, bop: false, epl: 1, contractor: true },
  'Artisan Contractor - Electrical': { auto: 1.1, gl: 4.1, bop: false, epl: 1, contractor: true },
  'Artisan Contractor - Plumbing/HVAC': { auto: 1.15, gl: 4.6, bop: false, epl: 1, contractor: true },
  'Landscaping/Lawn Care': { auto: 1.1, gl: 3.4, bop: false, epl: 1.05, contractor: true },
  'Janitorial/Cleaning Services': { auto: 0.95, gl: 2.4, bop: false, epl: 1.15, contractor: true },
  'Retail Store': { auto: 0.9, gl: 1.1, bop: true, epl: 1.1, contractor: false },
  'Restaurant (limited cooking)': { auto: 1, gl: 1.9, bop: true, epl: 1.4, contractor: false },
  'Office/Professional Services': { auto: 0.8, gl: 0.45, bop: true, epl: 0.9, contractor: false },
  'Food Truck/Catering': { auto: 1.2, gl: 2.2, bop: false, epl: 1.25, contractor: false },
  'Courier/Local Delivery': { auto: 1.45, gl: 0.9, bop: false, epl: 1.1, contractor: false },
  'For-Hire Trucking': { auto: 2.2, gl: 0.8, bop: false, epl: 1.05, contractor: false },
  'Nonprofit Organization': { auto: 0.9, gl: 0.7, bop: true, epl: 1.2, contractor: false },
};
const industryOf = (ctx: RateContext) => INDUSTRIES[ctx.commercial?.business.industry ?? ''] ?? INDUSTRIES['Office/Professional Services'];

export const YEARS_IN_BUSINESS = choices(['New venture (less than 1 year)', '1 to 2 years', '3 to 5 years', 'More than 5 years']);
export const YEARS_FACTOR: Record<string, number> = { 'New venture (less than 1 year)': 1.35, '1 to 2 years': 1.15, '3 to 5 years': 1, 'More than 5 years': 0.92 };

export const BUSINESS_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Business Name:*', type: 'text', required: true, help: 'The legal name exactly as it appears on the business registration or tax filings.' },
  { key: 'dba', label: 'DBA (Doing Business As):', type: 'text' },
  { key: 'entity', label: 'Business Entity Type:*', type: 'select', required: true, options: choices(['Sole Proprietor', 'Partnership', 'Limited Liability Company (LLC)', 'Corporation', 'Nonprofit Organization']) },
  { key: 'fein', label: 'FEIN / Tax ID:', type: 'digits', placeholder: '9 digits', help: 'Federal Employer Identification Number. Sole proprietors without employees may leave this blank.' },
  { key: 'industry', label: 'Business Type (Industry):*', type: 'select', required: true, options: choices(Object.keys(INDUSTRIES)), help: 'The industry class drives eligibility and rates for every commercial product. Choose the class that describes most of the revenue.' },
  { key: 'operations', label: 'Describe Business Operations:*', type: 'text', required: true, placeholder: 'e.g. residential remodeling' },
  { key: 'yearsInBusiness', label: 'Years in Business:*', type: 'select', required: true, tag: true, options: YEARS_IN_BUSINESS },
  { key: 'street', label: 'Business Street Address:*', type: 'text', required: true, divider: true },
  { key: 'city', label: 'City:*', type: 'text', required: true },
  { key: 'state', label: 'State:*', type: 'select', required: true, default: 'North Carolina', options: choices(US_STATES) },
  { key: 'zip', label: 'ZIP Code:*', type: 'zip', required: true },
  { key: 'contact', label: 'Primary Contact Name:*', type: 'text', required: true, divider: true },
  { key: 'phone', label: 'Business Phone:*', type: 'text', required: true, placeholder: 'XXX-XXX-XXXX' },
  { key: 'email', label: 'Business Email:*', type: 'text', required: true },
  { key: 'revenue', label: 'Annual Gross Revenue:*', type: 'money', required: true, tag: true, divider: true },
  { key: 'employees', label: 'Number of Employees:*', type: 'digits', required: true, tag: true, help: 'Total full- and part-time employees, including owners who work in the business.' },
  { key: 'payroll', label: 'Annual Payroll:*', type: 'money', required: true },
];

export const SHARED_QUESTIONS: QuestionDef[] = [
  { key: 'priorCoverage', label: 'Has the business had continuous commercial insurance for the past 12 months?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
  { key: 'losses', label: 'Number of commercial insurance claims in the past 3 years:*', type: 'select', required: true, options: choices(['0', '1', '2', '3 or more']) },
  { key: 'cancelled', label: 'Has any commercial policy been cancelled or non-renewed in the past 3 years (other than for nonpayment)?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Businesses with a prior cancellation or non-renewal must be referred to underwriting.' },
  { key: 'bankruptcy', label: 'Has the business or any owner filed for bankruptcy in the past 5 years?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'A bankruptcy in the past 5 years requires underwriting referral.' },
];

export const DRIVER_LICENSE_TYPES = ['Standard (Class C)', 'CDL - Class A', 'CDL - Class B'];
export const DRIVER_EXPERIENCE = ['Less than 3 years', '3 to 5 years', 'More than 5 years'];
export const DRIVER_VIOLATIONS = ['0', '1', '2', '3 or more'];
export const DRIVER_ACCIDENTS = ['0', '1', '2 or more'];

function commonDiscounts(ctx: RateContext, extra: [boolean, string, number][] = []) {
  const list: [boolean, string, number][] = [[ctx.multiPolicy, 'Multi Policy (Commercial)', 0.92], ...extra];
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

const commercialAuto: ProductConfig = {
  key: 'commercialAuto', tileLabel: 'COMMERCIAL AUTO', tabLabel: 'COMMERCIAL AUTO', name: 'Commercial Auto', unitLabel: 'Vehicle', unitPlural: 'Vehicles', multiUnit: true, maxUnits: 10, termMonths: 12, motorized: true, usesMvr: true, idField: 'vin', minimumPremium: 900,
  unitFields: [
    { key: 'type', label: 'Vehicle Type:*', type: 'select', required: true, options: choices(['Pickup Truck', 'Cargo Van', 'Passenger Van', 'Box Truck', 'Dump Truck', 'Flatbed/Stake Truck', 'Tractor (Semi)', 'Private Passenger Auto']), help: 'Heavier vehicles and tractors carry higher liability rates.' },
    { key: 'vin', label: 'VIN:', type: 'vin', posRequired: true, help: 'Required before binding. A 17-character VIN (no I, O or Q).' },
    { key: 'year', label: 'Year:*', type: 'select', required: true, options: YEAR_CHOICES },
    { key: 'make', label: 'Make:*', type: 'select', required: true, options: choices(['Ford', 'Chevrolet', 'Ram', 'GMC', 'Toyota', 'Nissan', 'Isuzu', 'Freightliner', 'International', 'Mercedes-Benz', 'Other']) },
    { key: 'model', label: 'Model:*', type: 'text', required: true },
    { key: 'gvw', label: 'Gross Vehicle Weight (GVW):*', type: 'select', required: true, tag: true, options: choices(['0 - 10,000 lbs', '10,001 - 20,000 lbs', '20,001 - 26,000 lbs', 'Over 26,000 lbs']), help: 'Found on the door-jamb sticker. Over 26,000 lbs requires a CDL driver.' },
    { key: 'radius', label: 'Radius of Operation:*', type: 'select', required: true, tag: true, options: choices(['0 - 50 miles (local)', '51 - 200 miles (intermediate)', 'Over 200 miles (long haul)']) },
    { key: 'use', label: 'Vehicle Use:*', type: 'select', required: true, options: choices(['Service (carries tools/equipment)', 'Retail/Delivery', 'Commercial (hauls own goods)', 'For-hire (hauls goods of others)']) },
    { key: 'value', label: 'Stated Amount (Vehicle Value):*', type: 'money', required: true, tag: true },
    { key: 'garagingZip', label: 'Garaging Zip Code:*', type: 'zip', required: true },
  ],
  coverages: [
    { key: 'liability', label: 'Liability (Combined Single Limit):*', type: 'select', scope: 'policy', required: true, default: '1000000', options: choices([['300000', '$300,000 CSL', 900], ['500000', '$500,000 CSL', 1150], ['750000', '$750,000 CSL', 1350], ['1000000', '$1,000,000 CSL', 1550]]), help: 'Many customer contracts require $1,000,000. Ask for a copy of any contract requirement.' },
    { key: 'um', label: 'Uninsured/Underinsured Motorist (CSL):*', type: 'select', scope: 'policy', required: true, default: '300000', options: choices([['300000', '$300,000', 60], ['500000', '$500,000', 80], ['1000000', '$1,000,000', 110]]) },
    { key: 'medpay', label: 'Medical Payments:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['2000', '$2,000', 20], ['5000', '$5,000', 35]]) },
    { key: 'hnoa', label: 'Hired & Non-Owned Auto:*', type: 'select', scope: 'policy', required: true, default: 'No', tag: true, options: choices([['No', 'No', 0], ['Yes', 'Yes', 145]]), help: 'Covers liability when employees drive rented or personal vehicles for the business.' },
    deductible('comp', 'Comprehensive Deductible:*'),
    deductible('coll', 'Collision Deductible:*'),
    { key: 'rental', label: 'Rental Reimbursement:*', type: 'select', scope: 'unit', required: true, default: 'None', options: choices([['None', 'None', 0], ['50', '$50/day, 30 days', 60], ['100', '$100/day, 30 days', 105]]) },
    { key: 'towing', label: 'Roadside Assistance:*', type: 'select', scope: 'unit', required: true, default: 'None', options: choices([['None', 'None', 0], ['Yes', 'Yes', 40]]) },
  ],
  questions: [
    { key: 'hazmat', label: 'Does the business transport hazardous materials requiring placards?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Placarded hazardous materials haulers are not eligible for this program.' },
    { key: 'filing', label: 'Does the business need a USDOT, MC or state filing?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Interstate haulers and for-hire carriers usually need a USDOT number and filings.' },
    { key: 'usdot', label: 'USDOT Number:*', type: 'digits', required: true, showIf: ({ values }) => values.filing === 'Yes' },
    { key: 'mvrReview', label: 'Does the business review driver MVRs at least annually?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
  ],
  unitRules: (values): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (values.type === 'Tractor (Semi)' && values.gvw && values.gvw !== 'Over 26,000 lbs') errors.gvw = 'A tractor must be rated over 26,000 lbs GVW.';
    return errors;
  },
  describe: describeVehicle,
  rate(ctx, quote): ProductRateResult {
    const commercial = ctx.commercial;
    const mvr = quote.answers.mvrReview === 'Yes';
    const discounts = commonDiscounts(ctx, [[mvr, 'Driver MVR Review', 0.95]]);
    const industry = industryOf(ctx);
    const load = (commercial?.yearsFactor ?? 1) * (commercial?.lossFactor ?? 1);
    const drivers = commercial?.driverFactor ?? 1;
    const extraDrivers = Math.max(0, (commercial?.driverCount ?? 0) - quote.units.length) * 0.08;
    const def = (key: string) => commercialAuto.coverages.find((entry) => entry.key === key);
    const units = quote.units.map((unit, index): UnitPremium => {
      const v = unit.values;
      const type = factor({ 'Pickup Truck': 1, 'Cargo Van': 1.05, 'Passenger Van': 1.2, 'Box Truck': 1.45, 'Dump Truck': 1.7, 'Flatbed/Stake Truck': 1.4, 'Tractor (Semi)': 2.6, 'Private Passenger Auto': 0.85 }, v.type);
      const gvw = factor({ '0 - 10,000 lbs': 1, '10,001 - 20,000 lbs': 1.3, '20,001 - 26,000 lbs': 1.6, 'Over 26,000 lbs': 2.1 }, v.gvw);
      const radius = factor({ '0 - 50 miles (local)': 1, '51 - 200 miles (intermediate)': 1.25, 'Over 200 miles (long haul)': 1.6 }, v.radius);
      const use = factor({ 'Service (carries tools/equipment)': 1, 'Retail/Delivery': 1.15, 'Commercial (hauls own goods)': 1.1, 'For-hire (hauls goods of others)': 1.45 }, v.use);
      const value = money(v.value) || 30000;
      const dedFactor = (ded: string) => factor({ '500': 1.15, '1000': 1, '2500': 0.85 }, ded, 0);
      const territory = ctx.territory(v.garagingZip ?? '');
      const people = drivers * (1 + extraDrivers) * load;
      const amounts: Record<string, number> = {
        liability: baseOf(def('liability'), quote.coverages.liability) * type * gvw * radius * use * industry.auto * territory * people * discounts.factor,
        um: baseOf(def('um'), quote.coverages.um),
        medpay: baseOf(def('medpay'), quote.coverages.medpay),
        hnoa: index === 0 ? baseOf(def('hnoa'), quote.coverages.hnoa) * industry.auto : 0,
        comp: value * 0.012 * dedFactor(unit.coverages.comp) * territory * discounts.factor,
        coll: value * 0.035 * dedFactor(unit.coverages.coll) * type * radius * people * discounts.factor,
        rental: baseOf(def('rental'), unit.coverages.rental),
        towing: baseOf(def('towing'), unit.coverages.towing),
        filing: index === 0 && quote.answers.filing === 'Yes' ? 50 : 0,
      };
      const rounded = Object.fromEntries(Object.entries(amounts).map(([key, amount]) => [key, round2(amount)]));
      return { unitId: unit.id, label: describeVehicle(unit), amounts: rounded, total: totalOf(rounded) };
    });
    return { units, policy: {}, discounts: discounts.names, factors: [...baseFactors(ctx), { label: 'Driver schedule', value: pct(drivers) }, ...discounts.factors] };
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
    { key: 'subcontracted', label: 'Percentage of work subcontracted to others:*', type: 'select', required: true, options: choices(['None', '1% - 25%', '26% - 50%', 'More than 50%']), ineligibleIf: 'More than 50%', ineligibleMessage: 'Businesses that subcontract more than 50% of their work are not eligible.' },
    { key: 'certificates', label: 'Does the business obtain certificates of insurance from all subcontractors?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'heights', label: 'Does any work involve roofing or heights above three stories?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Roofing and work above three stories are not eligible for this program.' },
    { key: 'alcohol', label: 'Do alcohol sales exceed 25% of revenue?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Businesses with more than 25% alcohol sales need liquor liability and are not eligible.' },
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
    const discounts = commonDiscounts(ctx, [[certificates && industry.contractor, 'Subcontractor Certificates', 0.95]]);
    const isBop = quote.answers.form !== 'Contractor General Liability (GL only)';
    const revenue = money(commercial?.business.revenue ?? '') || 250000;
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
        glLimits: index === 0 ? Math.max(400, revenue / 1000 * industry.gl) * limit * load * territory * discounts.factor : 0,
        property: isBop && premises ? insuredValue / 100 * 0.28 * construction * protection * ded * age * territory * discounts.factor : 0,
        equipmentBreakdown: isBop && premises ? baseOf(def('equipmentBreakdown'), quote.coverages.equipmentBreakdown) : 0,
        hnoa: index === 0 ? baseOf(def('hnoa'), quote.coverages.hnoa) : 0,
        tools: index === 0 ? baseOf(def('tools'), quote.coverages.tools) * load : 0,
        dishonesty: index === 0 ? baseOf(def('dishonesty'), quote.coverages.dishonesty) : 0,
      };
      const rounded = Object.fromEntries(Object.entries(amounts).map(([key, amount]) => [key, round2(amount)]));
      return { unitId: unit.id, label: bop.describe(unit), amounts: rounded, total: totalOf(rounded) };
    });
    return { units, policy: {}, discounts: discounts.names, factors: [{ label: 'Coverage form', value: isBop ? 'Businessowners Policy' : 'Contractor General Liability' }, { label: 'Revenue basis', value: `$${revenue.toLocaleString('en-US')} × ${industry.gl} per $1,000` }, ...baseFactors(ctx), ...discounts.factors] };
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
      const epli = c.epli === 'No' ? 0 : epliBase * factor({ '250000': 1, '500000': 1.3, '1000000': 1.6 }, c.epli) * factor({ '2500': 1.1, '5000': 1, '10000': 0.9 }, c.epliRetention) * factor({ 'Less than 10%': 1, '10% - 25%': 1.15, 'More than 25%': 1.35 }, v.turnover) * industry.epl * (a.priorEpl === '1' ? 1.4 : 1) * (a.handbook === 'Yes' ? 0.9 : 1) * load * discounts.factor;
      const npdo = c.npdo === 'No' ? 0 : Math.max(750, revenue / 1000 * 0.9) * factor({ '500000': 1, '1000000': 1.35 }, c.npdo) * load * discounts.factor;
      const records = factor({ 'Fewer than 10,000': 250, '10,000 - 100,000': 600, 'More than 100,000': 1400 }, v.records, 250);
      const cyber = c.cyber === 'No' ? 0 : (clamp(revenue / 1000 * 0.55, 300, 20000) + records) * factor({ '100000': 0.6, '250000': 1, '500000': 1.5, '1000000': 2.2 }, c.cyber) * factor({ '1000': 1.1, '2500': 1, '5000': 0.92 }, c.cyberRetention) * (a.backups === 'Yes' ? 0.9 : 1) * (v.cards === 'Yes' ? 1.15 : 1) * discounts.factor;
      const amounts = { epli: round2(epli), npdo: round2(npdo), cyber: round2(cyber) };
      return { unitId: unit.id, label: mgmt.describe(unit), amounts, total: totalOf(amounts) };
    });
    return { units, policy: {}, discounts: [...discounts.names, ...(a.handbook === 'Yes' ? ['Employee Handbook'] : []), ...(a.backups === 'Yes' ? ['Data Backups'] : [])], factors: [...baseFactors(ctx), ...discounts.factors] };
  },
};

export const COMMERCIAL_CONFIGS: Record<CommercialKey, ProductConfig> = { commercialAuto, bop, mgmt };
export const COMMERCIAL_PRODUCTS = Object.keys(COMMERCIAL_CONFIGS) as CommercialKey[];
