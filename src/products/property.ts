// Condo Unit Owners (HO6) and Landlord / Dwelling Fire (DP-3). Like Homeowners, they can carry
// mortgagees and be escrow-billed. Base rates and factors are LAVA training values, not any
// carrier's filed rates.
import type { CoverageDef, OtherProductKey, ProductConfig, ProductRateResult, UnitPremium } from '@/products/types';
import { YES_NO_CHOICES, baseOf, choices, factor, money, pct, round2 } from '@/products/helpers';
import { stateForZip } from '@/data/states';
import { clockDate } from '@/utils/clock';
import { AOP_DEDUCTIBLE, CLAIMS, CONSTRUCTION, MIN_COST_PER_SQFT, PRIOR_HOME_CARRIERS, PROTECTION, ROOF_TYPE, WIND_DEDUCTIBLE, WIND_LOAD } from '@/products/homeowners';

/** Products that insure a dwelling and can list mortgagees (and be billed to them). */
export const MORTGAGEE_PRODUCTS: OtherProductKey[] = ['homeowners', 'condo', 'landlord'];

const thisYear = () => clockDate().getFullYear();
const windFor = (zip: string, deductible: string) => 1 + ((WIND_LOAD[stateForZip(zip) ?? ''] ?? 1) - 1) * factor(WIND_DEDUCTIBLE, deductible || 'Same');
const escrowQuestion = { key: 'mortgageeBilled', label: 'Is the premium paid by the mortgage company (escrow)?*', type: 'select' as const, required: true, options: YES_NO_CHOICES, help: 'Escrow: the mortgage company pays the full annual premium from the escrow account. Requires a first mortgagee.' };
const claimsQuestion = { key: 'claims', label: 'Property claims at this or any residence in the past 5 years:*', type: 'select' as const, required: true, options: choices(['0 Claims', '1 Claim', '2 Claims', '3 or more Claims']), ineligibleIf: '3 or more Claims', ineligibleMessage: 'Applicants with 3 or more property claims in the past 5 years are not eligible.' };
const sameAsMailing = { key: 'sameAsMailing', label: 'Property address same as mailing address:*', type: 'select' as const, required: true, options: YES_NO_CHOICES, default: 'Yes' };
const street = { key: 'street', label: 'Address Line 1:*', type: 'text' as const, required: true, showIf: ({ values }: { values: Record<string, string> }) => values.sameAsMailing === 'No' };
const city = { key: 'city', label: 'City:*', type: 'text' as const, required: true, showIf: ({ values }: { values: Record<string, string> }) => values.sameAsMailing === 'No' };
const discountFactor = (ctx: { multiPolicy: boolean; paperless: boolean }) => (ctx.multiPolicy ? 0.9 : 1) * (ctx.paperless ? 0.97 : 1);
const sum = (amounts: Record<string, number>) => round2(Object.values(amounts).reduce((total, amount) => total + amount, 0));

// ------------------------------------------------------------------ Condo Unit Owners (HO6)

const condoCoverages: CoverageDef[] = [
  { key: 'lossAssessment', label: 'Loss Assessment:*', type: 'select', scope: 'policy', required: true, default: '1000', options: choices([['1000', '$1,000 (included)', 0], ['10000', '$10,000', 18], ['25000', '$25,000', 32], ['50000', '$50,000', 48]]), help: 'Pays the owner\'s share when the association assesses unit owners for a covered loss to common areas.' },
  { key: 'lossOfUse', label: 'Loss of Use (Coverage D):', type: 'select', scope: 'policy', default: '50', options: choices([['50', '50% of Coverage C (included)']]) },
  { key: 'liability', label: 'Personal Liability (Coverage E):*', type: 'select', scope: 'policy', required: true, default: '300000', options: choices([['100000', '$100,000', 18], ['300000', '$300,000', 28], ['500000', '$500,000', 38]]) },
  { key: 'medpay', label: 'Medical Payments to Others (Coverage F):*', type: 'select', scope: 'policy', required: true, default: '1000', options: choices([['1000', '$1,000', 0], ['2500', '$2,500', 5], ['5000', '$5,000', 9]]) },
  { key: 'deductible', label: 'All Other Perils Deductible:*', type: 'select', scope: 'policy', required: true, default: '1000', options: choices([['500', '$500'], ['1000', '$1,000'], ['2500', '$2,500']]) },
  { key: 'windDeductible', label: 'Wind/Hail Deductible:*', type: 'select', scope: 'policy', required: true, default: 'Same', options: choices([['Same', 'Same as All Other Perils'], ['1', '1% of Coverage A'], ['2', '2% of Coverage A'], ['5', '5% of Coverage A']]) },
  { key: 'rcContents', label: 'Personal Property Replacement Cost:*', type: 'select', scope: 'policy', required: true, default: 'Yes', options: YES_NO_CHOICES },
  { key: 'waterBackup', label: 'Water Backup and Sump Overflow:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['5000', '$5,000', 30], ['10000', '$10,000', 50]]) },
];

export const condo: ProductConfig = {
  key: 'condo', tileLabel: 'CONDO (HO6)', tabLabel: 'CONDO', name: 'Condo Unit Owners (HO6)', unitLabel: 'Condo Unit', unitPlural: 'Condo Units', multiUnit: false, maxUnits: 1, termMonths: 12, motorized: false, usesMvr: false, minimumPremium: 150,
  unitFields: [
    sameAsMailing, street, city,
    { key: 'unitNumber', label: 'Unit Number:*', type: 'text', required: true },
    { key: 'garagingZip', label: 'Unit Zip Code:*', type: 'zip', required: true },
    { key: 'yearBuilt', label: 'Year the Building Was Built:*', type: 'digits', required: true },
    { key: 'construction', label: 'Building Construction:*', type: 'select', required: true, options: choices(Object.keys(CONSTRUCTION)) },
    { key: 'floor', label: 'Floor of the Unit:*', type: 'select', required: true, options: choices(['Ground floor', '2nd - 4th floor', '5th floor or higher']), help: 'Ground-floor units have more water and theft losses.' },
    { key: 'occupancy', label: 'Occupancy:*', type: 'select', required: true, options: choices(['Owner occupied (primary home)', 'Owner occupied (secondary/seasonal)', 'Rented to others (long-term lease)']) },
    { key: 'sprinklered', label: 'Building Has Automatic Sprinklers:*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'unitValue', label: 'Dwelling / Walls-In (Coverage A):*', type: 'money', required: true, help: 'Interior walls, floors, cabinets, fixtures and improvements the owner must insure under the association\'s master policy (often called "walls-in").' },
    { key: 'personalProperty', label: 'Personal Property (Coverage C):*', type: 'money', required: true },
  ],
  coverages: condoCoverages,
  questions: [
    { key: 'priorInsurer', label: 'Current or Prior Condo/Homeowners Insurer:*', type: 'select', required: true, options: choices(PRIOR_HOME_CARRIERS) },
    claimsQuestion,
    { key: 'masterPolicy', label: 'Does the association master policy cover the building structure (bare walls or more)?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'No', ineligibleMessage: 'HO6 covers the unit owner\'s interest only. The building structure must be insured by the association master policy.' },
    escrowQuestion,
  ],
  unitRules: (values) => {
    const errors: Record<string, string> = {};
    const built = Number(values.yearBuilt);
    if (values.yearBuilt && (built < 1850 || built > thisYear() + 1)) errors.yearBuilt = `Enter a year built between 1850 and ${thisYear() + 1}.`;
    if (values.unitValue && money(values.unitValue) < 10000) errors.unitValue = 'Coverage A (walls-in) must be at least $10,000.';
    if (values.personalProperty && (money(values.personalProperty) < 10000 || money(values.personalProperty) > 300000)) errors.personalProperty = 'Personal Property must be between $10,000 and $300,000.';
    return errors;
  },
  describe: (unit) => [unit.values.unitNumber && `Unit ${unit.values.unitNumber}`, unit.values.floor].filter(Boolean).join(' · ') || 'Condo Unit',
  rate(ctx, quote): ProductRateResult {
    const a = quote.answers;
    const c = quote.coverages;
    const def = (key: string) => condoCoverages.find((entry) => entry.key === key);
    const discount = discountFactor(ctx);
    const units = quote.units.map((unit): UnitPremium => {
      const v = unit.values;
      const age = Number(v.yearBuilt) ? thisYear() - Number(v.yearBuilt) : 25;
      const occupancy = factor({ 'Owner occupied (primary home)': 1, 'Owner occupied (secondary/seasonal)': 1.2, 'Rented to others (long-term lease)': 1.45 }, v.occupancy);
      const floor = factor({ 'Ground floor': 1.12, '2nd - 4th floor': 1, '5th floor or higher': 0.95 }, v.floor);
      const building = factor(CONSTRUCTION, v.construction) * (v.sprinklered === 'Yes' ? 0.9 : 1) * (age > 40 ? 1.12 : age < 10 ? 0.92 : 1);
      const history = factor(CLAIMS, a.claims ?? '0 Claims') * (a.priorInsurer === 'No prior homeowners insurance' ? 1.2 : 1);
      const common = ctx.territory(v.garagingZip ?? '') * windFor(v.garagingZip ?? '', c.windDeductible) * floor * occupancy * building * factor(AOP_DEDUCTIBLE, c.deductible ?? '1000') * history * ctx.scoreFactor * discount;
      const walls = money(v.unitValue ?? '') / 1000 * 3.1 * common;
      const contents = money(v.personalProperty ?? '') / 1000 * 4.2 * common;
      const amounts = {
        unitValue: round2(walls),
        personalProperty: round2(contents),
        rcContents: c.rcContents === 'Yes' ? round2(contents * 0.12) : 0,
        lossAssessment: baseOf(def('lossAssessment'), c.lossAssessment ?? ''),
        liability: round2(baseOf(def('liability'), c.liability ?? '') * (v.occupancy === 'Rented to others (long-term lease)' ? 1.3 : 1) * discount),
        medpay: baseOf(def('medpay'), c.medpay ?? ''),
        waterBackup: baseOf(def('waterBackup'), c.waterBackup ?? ''),
      };
      return { unitId: unit.id, label: condo.describe(unit), amounts, total: sum(amounts) };
    });
    const v = quote.units[0]?.values ?? {};
    return {
      units, policy: {},
      discounts: [...(ctx.multiPolicy ? ['Multi Policy'] : []), ...(ctx.paperless ? ['Paperless'] : []), ...(v.sprinklered === 'Yes' ? ['Sprinklered Building'] : [])],
      factors: [
        { label: 'Rating tier (insurance score)', value: ctx.reportsApplied ? pct(ctx.scoreFactor) : 'Preliminary (reports not yet ordered)' },
        { label: `Territory (unit ZIP ${v.garagingZip || '—'})`, value: pct(ctx.territory(v.garagingZip ?? '')) },
        { label: `Occupancy (${v.occupancy || '—'})`, value: pct(factor({ 'Owner occupied (primary home)': 1, 'Owner occupied (secondary/seasonal)': 1.2, 'Rented to others (long-term lease)': 1.45 }, v.occupancy)) },
        { label: 'Claims and prior insurance', value: pct(factor(CLAIMS, quote.answers.claims ?? '0 Claims')) },
      ],
    };
  },
};

// ------------------------------------------------------------------ Landlord / Dwelling Fire (DP-3)

const landlordCoverages: CoverageDef[] = [
  { key: 'otherStructures', label: 'Other Structures (Coverage B):*', type: 'select', scope: 'policy', required: true, default: '10', options: choices([['10', '10% of Coverage A'], ['20', '20% of Coverage A']]) },
  { key: 'fairRental', label: 'Fair Rental Value (Coverage D):*', type: 'select', scope: 'policy', required: true, default: '20', options: choices([['10', '10% of Coverage A'], ['20', '20% of Coverage A']]), help: 'Replaces the rent lost while the property cannot be rented after a covered loss.' },
  { key: 'landlordContents', label: "Landlord's Furnishings:*", type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['5000', '$5,000', 25], ['10000', '$10,000', 45]]), help: 'Appliances, carpets and furnishings the landlord provides to tenants. Tenants insure their own belongings (renters/HO4).' },
  { key: 'liability', label: 'Premises Liability:*', type: 'select', scope: 'policy', required: true, default: '300000', options: choices([['100000', '$100,000', 60], ['300000', '$300,000', 85], ['500000', '$500,000', 110]]) },
  { key: 'medpay', label: 'Medical Payments to Others:*', type: 'select', scope: 'policy', required: true, default: '1000', options: choices([['1000', '$1,000', 0], ['2500', '$2,500', 8], ['5000', '$5,000', 14]]) },
  { key: 'deductible', label: 'All Other Perils Deductible:*', type: 'select', scope: 'policy', required: true, default: '1000', options: choices([['500', '$500'], ['1000', '$1,000'], ['2500', '$2,500'], ['5000', '$5,000']]) },
  { key: 'windDeductible', label: 'Wind/Hail Deductible:*', type: 'select', scope: 'policy', required: true, default: 'Same', options: choices([['Same', 'Same as All Other Perils'], ['1', '1% of Coverage A'], ['2', '2% of Coverage A'], ['5', '5% of Coverage A']]) },
];

export const landlord: ProductConfig = {
  key: 'landlord', tileLabel: 'LANDLORD (DP3)', tabLabel: 'LANDLORD', name: 'Landlord (DP-3)', unitLabel: 'Rental Dwelling', unitPlural: 'Rental Dwellings', multiUnit: false, maxUnits: 1, termMonths: 12, motorized: false, usesMvr: false, minimumPremium: 400,
  unitFields: [
    { ...sameAsMailing, label: 'Rental property address same as mailing address:*', default: 'No' }, street, city,
    { key: 'garagingZip', label: 'Rental Property Zip Code:*', type: 'zip', required: true },
    { key: 'families', label: 'Number of Units (Families):*', type: 'select', required: true, options: choices(['1 (single family)', '2 (duplex)', '3 (triplex)', '4 (fourplex)']) },
    { key: 'yearBuilt', label: 'Year Built:*', type: 'digits', required: true },
    { key: 'squareFeet', label: 'Living Area (square feet):*', type: 'digits', required: true },
    { key: 'construction', label: 'Construction Type:*', type: 'select', required: true, options: choices(Object.keys(CONSTRUCTION)) },
    { key: 'roofType', label: 'Roof Material:*', type: 'select', required: true, options: choices(Object.keys(ROOF_TYPE)) },
    { key: 'roofYear', label: 'Year Roof Installed or Replaced:*', type: 'digits', required: true },
    { key: 'protection', label: 'Fire Protection:*', type: 'select', required: true, options: choices(Object.keys(PROTECTION)) },
    { key: 'lease', label: 'Tenant Lease Type:*', type: 'select', required: true, options: choices(['Annual lease (12 months or longer)', 'Month-to-month', 'Short-term / vacation rental (under 6 months)']) },
    { key: 'dwellingValue', label: 'Dwelling Replacement Cost (Coverage A):*', type: 'money', required: true },
  ],
  coverages: landlordCoverages,
  questions: [
    { key: 'priorInsurer', label: 'Current or Prior Landlord Insurer:*', type: 'select', required: true, options: choices(PRIOR_HOME_CARRIERS) },
    claimsQuestion,
    { key: 'vacant', label: 'Has the property been vacant more than 60 days in a row in the past year?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Properties vacant more than 60 days need a vacancy policy and are not eligible.' },
    { key: 'tenantsScreened', label: 'Are tenants screened (credit and background) before signing a lease?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    escrowQuestion,
  ],
  unitRules: (values) => {
    const errors: Record<string, string> = {};
    const year = thisYear();
    const built = Number(values.yearBuilt);
    const roof = Number(values.roofYear);
    const value = money(values.dwellingValue ?? '');
    const area = Number(values.squareFeet);
    if (values.yearBuilt && (built < 1850 || built > year + 1)) errors.yearBuilt = `Enter a year built between 1850 and ${year + 1}.`;
    if (values.roofYear && (roof > year + 1 || (built && roof < built))) errors.roofYear = 'The roof year must be between the year built and this year.';
    else if (values.roofYear && year - roof > 25) errors.roofYear = 'Roofs older than 25 years are not eligible.';
    if (values.lease === 'Short-term / vacation rental (under 6 months)') errors.lease = 'Short-term and vacation rentals are not eligible for Landlord (DP-3).';
    if (values.dwellingValue && (value < 50_000 || value > 1_500_000)) errors.dwellingValue = 'Coverage A must be between $50,000 and $1,500,000.';
    else if (value && area && value / area < MIN_COST_PER_SQFT * 0.9) errors.dwellingValue = `Coverage A is under $${MIN_COST_PER_SQFT * 0.9} per square foot. Insure the dwelling to its full replacement cost.`;
    return errors;
  },
  describe: (unit) => {
    const v = unit.values;
    const value = money(v.dwellingValue ?? '');
    return [v.families && `${v.families.split(' ')[0]}-family rental`, v.street, value && `Coverage A $${value.toLocaleString('en-US')}`].filter(Boolean).join(' · ') || 'Rental Dwelling';
  },
  rate(ctx, quote): ProductRateResult {
    const a = quote.answers;
    const c = quote.coverages;
    const def = (key: string) => landlordCoverages.find((entry) => entry.key === key);
    const discount = discountFactor(ctx) * (a.tenantsScreened === 'Yes' ? 0.95 : 1);
    const year = thisYear();
    const units = quote.units.map((unit): UnitPremium => {
      const v = unit.values;
      const coverageA = money(v.dwellingValue ?? '') || 200_000;
      const age = Number(v.yearBuilt) ? year - Number(v.yearBuilt) : 30;
      const roofAge = Number(v.roofYear) ? year - Number(v.roofYear) : 10;
      const families = factor({ '1 (single family)': 1, '2 (duplex)': 1.18, '3 (triplex)': 1.32, '4 (fourplex)': 1.45 }, v.families);
      const homeAge = age <= 10 ? 0.92 : age <= 30 ? 1 : age <= 60 ? 1.15 : 1.3;
      const roofAgeFactor = roofAge <= 5 ? 0.92 : roofAge <= 15 ? 1 : roofAge <= 20 ? 1.12 : 1.25;
      const lease = v.lease === 'Month-to-month' ? 1.1 : 1;
      const history = factor(CLAIMS, a.claims ?? '0 Claims') * (a.priorInsurer === 'No prior homeowners insurance' ? 1.2 : 1);
      const extras = (c.otherStructures === '20' ? 1.02 : 1) * (c.fairRental === '20' ? 1.04 : 1);
      // Dwelling premium: $4.40 per $1,000 of Coverage A (rental dwellings carry more risk than owner-occupied homes).
      const dwelling = coverageA / 1000 * 4.4 * ctx.territory(v.garagingZip ?? '') * windFor(v.garagingZip ?? '', c.windDeductible) * families * homeAge * roofAgeFactor
        * factor(ROOF_TYPE, v.roofType) * factor(CONSTRUCTION, v.construction) * factor(PROTECTION, v.protection) * factor(AOP_DEDUCTIBLE, c.deductible ?? '1000') * lease * history * extras * ctx.scoreFactor * discount;
      const amounts = {
        dwelling: round2(dwelling),
        landlordContents: baseOf(def('landlordContents'), c.landlordContents ?? ''),
        liability: round2(baseOf(def('liability'), c.liability ?? '') * families * discount),
        medpay: baseOf(def('medpay'), c.medpay ?? ''),
      };
      return { unitId: unit.id, label: landlord.describe(unit), amounts, total: sum(amounts) };
    });
    const v = quote.units[0]?.values ?? {};
    return {
      units, policy: {},
      discounts: [...(ctx.multiPolicy ? ['Multi Policy'] : []), ...(ctx.paperless ? ['Paperless'] : []), ...(a.tenantsScreened === 'Yes' ? ['Tenant Screening'] : [])],
      factors: [
        { label: 'Rating tier (insurance score)', value: ctx.reportsApplied ? pct(ctx.scoreFactor) : 'Preliminary (reports not yet ordered)' },
        { label: `Territory (rental ZIP ${v.garagingZip || '—'})`, value: pct(ctx.territory(v.garagingZip ?? '')) },
        { label: `Units (${v.families || '—'})`, value: pct(factor({ '1 (single family)': 1, '2 (duplex)': 1.18, '3 (triplex)': 1.32, '4 (fourplex)': 1.45 }, v.families)) },
        { label: 'Claims and prior insurance', value: pct(factor(CLAIMS, quote.answers.claims ?? '0 Claims')) },
      ],
    };
  },
};
