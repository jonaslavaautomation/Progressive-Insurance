// Homeowners (HO3): an owner-occupied dwelling. Coverage A (dwelling) drives the premium; Coverages
// B (other structures), C (personal property) and D (loss of use) are set as percentages of A, like a
// standard HO3 policy. Base rates and factors are LAVA training values, not any carrier's filed rates.
import type { CoverageDef, ProductConfig, ProductRateResult, UnitPremium } from '@/products/types';
import { YES_NO_CHOICES, baseOf, choices, factor, money, pct, round2 } from '@/products/helpers';
import { stateForZip } from '@/data/states';
import { clockDate } from '@/utils/clock';

export const DWELLING_LIMITS = { min: 75_000, max: 1_500_000 };
/** Insurance to value: Coverage A should be at least this much per square foot. */
export const MIN_COST_PER_SQFT = 100;

export const PRIOR_HOME_CARRIERS = ['No prior homeowners insurance', 'Allstate', 'American Family', 'Erie', 'Farmers', 'Liberty Mutual', 'Nationwide', 'State Farm', 'Travelers', 'USAA', 'Other'];
export const CONSTRUCTION = { Frame: 1, 'Brick Veneer': 0.95, Masonry: 0.9, 'Superior (fire resistive)': 0.82 } as Record<string, number>;
export const ROOF_TYPE = { 'Asphalt Shingle': 1, 'Architectural Shingle': 0.97, Metal: 0.92, Tile: 0.95, 'Wood Shake': 1.2, Flat: 1.08 } as Record<string, number>;
export const PROTECTION = { 'Protected (hydrant within 1,000 ft, fire station within 5 miles)': 1, 'Partially protected (fire station within 5 miles, no hydrant)': 1.25, 'Unprotected (more than 5 miles to a fire station)': 1.6 } as Record<string, number>;
export const AOP_DEDUCTIBLE = { '500': 1.1, '1000': 1, '2500': 0.85, '5000': 0.75 } as Record<string, number>;
/** Windstorm/hurricane exposure by state: Florida and Texas carry most of the U.S. wind risk. */
export const WIND_LOAD: Record<string, number> = { Florida: 1.9, Texas: 1.55, 'North Carolina': 1.12 };
export const WIND_DEDUCTIBLE = { Same: 1, '1': 0.88, '2': 0.8, '5': 0.68 } as Record<string, number>;
export const CLAIMS = { '0 Claims': 1, '1 Claim': 1.3, '2 Claims': 1.65 } as Record<string, number>;

const thisYear = () => clockDate().getFullYear();
const def = (key: string) => homeownersCoverages.find((entry) => entry.key === key);

export const homeownersCoverages: CoverageDef[] = [
  { key: 'otherStructures', label: 'Other Structures (Coverage B):*', type: 'select', scope: 'policy', required: true, default: '10', options: choices([['10', '10% of Coverage A'], ['20', '20% of Coverage A']]), help: 'Detached garage, fence, shed and other structures not attached to the home.' },
  { key: 'personalProperty', label: 'Personal Property (Coverage C):*', type: 'select', scope: 'policy', required: true, default: '50', options: choices([['50', '50% of Coverage A'], ['70', '70% of Coverage A'], ['75', '75% of Coverage A']]) },
  { key: 'lossOfUse', label: 'Loss of Use (Coverage D):', type: 'select', scope: 'policy', default: '20', options: choices([['20', '20% of Coverage A (included)']]), help: 'Additional living expenses while the home cannot be lived in after a covered loss.' },
  { key: 'liability', label: 'Personal Liability (Coverage E):*', type: 'select', scope: 'policy', required: true, default: '300000', options: choices([['100000', '$100,000', 22], ['300000', '$300,000', 34], ['500000', '$500,000', 46]]) },
  { key: 'medpay', label: 'Medical Payments to Others (Coverage F):*', type: 'select', scope: 'policy', required: true, default: '1000', options: choices([['1000', '$1,000', 0], ['2500', '$2,500', 6], ['5000', '$5,000', 11]]) },
  { key: 'deductible', label: 'All Other Perils Deductible:*', type: 'select', scope: 'policy', required: true, default: '1000', options: choices([['500', '$500'], ['1000', '$1,000'], ['2500', '$2,500'], ['5000', '$5,000']]) },
  { key: 'windDeductible', label: 'Wind/Hail Deductible:*', type: 'select', scope: 'policy', required: true, default: 'Same', options: choices([['Same', 'Same as All Other Perils'], ['1', '1% of Coverage A'], ['2', '2% of Coverage A'], ['5', '5% of Coverage A']]), help: 'A percentage deductible applies to windstorm and hail losses. Common (and often required) in coastal states.' },
  { key: 'rcContents', label: 'Personal Property Replacement Cost:*', type: 'select', scope: 'policy', required: true, default: 'Yes', options: YES_NO_CHOICES, help: 'Pays to replace belongings new instead of their depreciated value.' },
  { key: 'waterBackup', label: 'Water Backup and Sump Overflow:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['5000', '$5,000', 40], ['10000', '$10,000', 65]]) },
];

export const homeowners: ProductConfig = {
  key: 'homeowners', tileLabel: 'HOMEOWNERS (HO3)', tabLabel: 'HOMEOWNERS', name: 'Homeowners (HO3)', unitLabel: 'Dwelling', unitPlural: 'Dwellings', multiUnit: false, maxUnits: 1, termMonths: 12, motorized: false, usesMvr: false, minimumPremium: 300,
  unitFields: [
    { key: 'sameAsMailing', label: 'Dwelling address same as mailing address:*', type: 'select', required: true, options: YES_NO_CHOICES, default: 'Yes' },
    { key: 'street', label: 'Address Line 1:*', type: 'text', required: true, showIf: ({ values }) => values.sameAsMailing === 'No' },
    { key: 'city', label: 'City:*', type: 'text', required: true, showIf: ({ values }) => values.sameAsMailing === 'No' },
    { key: 'garagingZip', label: 'Dwelling Zip Code:*', type: 'zip', required: true, help: 'The dwelling ZIP sets the territory and windstorm rate. It must be in the quote state.' },
    { key: 'yearBuilt', label: 'Year Built:*', type: 'digits', required: true },
    { key: 'squareFeet', label: 'Living Area (square feet):*', type: 'digits', required: true },
    { key: 'construction', label: 'Construction Type:*', type: 'select', required: true, options: choices(Object.keys(CONSTRUCTION)) },
    { key: 'stories', label: 'Number of Stories:*', type: 'select', required: true, options: choices(['1', '1.5', '2', '3 or more']) },
    { key: 'roofType', label: 'Roof Material:*', type: 'select', required: true, options: choices(Object.keys(ROOF_TYPE)) },
    { key: 'roofYear', label: 'Year Roof Installed or Replaced:*', type: 'digits', required: true, help: 'Roofs older than 25 years are not eligible; older roofs cost more.' },
    { key: 'protection', label: 'Fire Protection:*', type: 'select', required: true, options: choices(Object.keys(PROTECTION)) },
    { key: 'alarm', label: 'Central Station Fire/Burglar Alarm:*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'dwellingValue', label: 'Dwelling Replacement Cost (Coverage A):*', type: 'money', required: true, help: 'What it would cost to rebuild the home today, not its market value or loan amount.' },
  ],
  coverages: homeownersCoverages,
  questions: [
    { key: 'priorInsurer', label: 'Current or Prior Homeowners Insurer:*', type: 'select', required: true, options: choices(PRIOR_HOME_CARRIERS) },
    { key: 'claims', label: 'Property claims at this or any residence in the past 5 years:*', type: 'select', required: true, options: choices(['0 Claims', '1 Claim', '2 Claims', '3 or more Claims']), ineligibleIf: '3 or more Claims', ineligibleMessage: 'Applicants with 3 or more property claims in the past 5 years are not eligible for Homeowners.' },
    { key: 'occupancy', label: 'Is the home rented to others, vacant, under construction or used for a business?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Homeowners covers owner-occupied homes only. Rented, vacant or business-use homes need a dwelling-fire or commercial policy.' },
    { key: 'hazards', label: 'Pool or trampoline without required fencing/netting, or an ineligible dog breed?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Unfenced pools, unnetted trampolines and ineligible dog breeds make the home ineligible.' },
    { key: 'mortgageeBilled', label: 'Is the premium paid by the mortgage company (escrow)?*', type: 'select', required: true, options: YES_NO_CHOICES, help: 'Escrow: the mortgage company pays the full annual premium from the escrow account. Requires a first mortgagee.' },
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
    else if (values.roofYear && year - roof > 25) errors.roofYear = 'Roofs older than 25 years are not eligible. The roof must be replaced first.';
    if (values.dwellingValue && (value < DWELLING_LIMITS.min || value > DWELLING_LIMITS.max)) errors.dwellingValue = `Coverage A must be between $${DWELLING_LIMITS.min.toLocaleString('en-US')} and $${DWELLING_LIMITS.max.toLocaleString('en-US')}.`;
    else if (value && area && value / area < MIN_COST_PER_SQFT) errors.dwellingValue = `Coverage A is under $${MIN_COST_PER_SQFT} per square foot ($${Math.round(value / area)}). Insure the home to its full replacement cost.`;
    return errors;
  },
  describe: (unit) => {
    const v = unit.values;
    const value = money(v.dwellingValue ?? '');
    return [v.yearBuilt && `${v.yearBuilt} ${v.construction || 'Dwelling'}`, value && `Coverage A $${value.toLocaleString('en-US')}`].filter(Boolean).join(' · ') || 'Dwelling';
  },
  rate(ctx, quote): ProductRateResult {
    const a = quote.answers;
    const c = quote.coverages;
    const year = thisYear();
    const extra: [boolean, string, number][] = [];
    const units = quote.units.map((unit): UnitPremium => {
      const v = unit.values;
      const coverageA = money(v.dwellingValue ?? '') || 250_000;
      const age = Number(v.yearBuilt) ? year - Number(v.yearBuilt) : 25;
      const roofAge = Number(v.roofYear) ? year - Number(v.roofYear) : 10;
      const state = stateForZip(v.garagingZip ?? '') ?? '';
      const homeAge = age <= 5 ? 0.88 : age <= 20 ? 1 : age <= 40 ? 1.1 : age <= 70 ? 1.22 : 1.35;
      const roofAgeFactor = roofAge <= 5 ? 0.92 : roofAge <= 15 ? 1 : roofAge <= 20 ? 1.12 : 1.25;
      const wind = 1 + ((WIND_LOAD[state] ?? 1) - 1) * factor(WIND_DEDUCTIBLE, c.windDeductible ?? 'Same');
      const contents = factor({ '50': 1, '70': 1.06, '75': 1.08 }, c.personalProperty ?? '50');
      const otherStructures = c.otherStructures === '20' ? 1.02 : 1;
      const history = factor(CLAIMS, a.claims ?? '0 Claims') * (a.priorInsurer === 'No prior homeowners insurance' ? 1.2 : 1);
      const alarm = v.alarm === 'Yes' ? 0.95 : 1;
      if (age <= 5) extra.push([true, 'New Home', 0.88]);
      if (v.alarm === 'Yes') extra.push([true, 'Protective Device', 0.95]);
      const discount = (ctx.multiPolicy ? 0.9 : 1) * (ctx.paperless ? 0.97 : 1);
      // Dwelling premium: $3.60 per $1,000 of Coverage A before factors (includes B, C and D).
      const dwelling = coverageA / 1000 * 3.6 * ctx.territory(v.garagingZip ?? '') * wind * factor(CONSTRUCTION, v.construction) * homeAge * roofAgeFactor * factor(ROOF_TYPE, v.roofType)
        * factor(PROTECTION, v.protection) * factor(AOP_DEDUCTIBLE, c.deductible ?? '1000') * contents * otherStructures * history * alarm * ctx.scoreFactor * discount;
      const amounts = {
        dwelling: round2(dwelling),
        liability: round2(baseOf(def('liability'), c.liability ?? '') * discount),
        medpay: baseOf(def('medpay'), c.medpay ?? ''),
        rcContents: c.rcContents === 'Yes' ? round2(dwelling * 0.1) : 0,
        waterBackup: baseOf(def('waterBackup'), c.waterBackup ?? ''),
      };
      return { unitId: unit.id, label: homeowners.describe(unit), amounts, total: round2(Object.values(amounts).reduce((sum, amount) => sum + amount, 0)) };
    });
    const discounts = [...(ctx.multiPolicy ? ['Multi Policy'] : []), ...(ctx.paperless ? ['Paperless'] : []), ...extra.map(([, name]) => name)];
    const unit = quote.units[0]?.values ?? {};
    const state = stateForZip(unit.garagingZip ?? '') ?? '';
    return {
      units,
      policy: {},
      discounts,
      factors: [
        { label: 'Rating tier (insurance score)', value: ctx.reportsApplied ? pct(ctx.scoreFactor) : 'Preliminary (reports not yet ordered)' },
        { label: `Territory (dwelling ZIP ${unit.garagingZip || '—'})`, value: pct(ctx.territory(unit.garagingZip ?? '')) },
        ...(WIND_LOAD[state] ? [{ label: `${state} windstorm exposure`, value: pct(WIND_LOAD[state]) }] : []),
        { label: `Construction (${unit.construction || '—'})`, value: pct(factor(CONSTRUCTION, unit.construction)) },
        { label: `Fire protection`, value: pct(factor(PROTECTION, unit.protection)) },
        { label: 'Claims and prior insurance', value: pct(factor(CLAIMS, a.claims ?? '0 Claims') * (a.priorInsurer === 'No prior homeowners insurance' ? 1.2 : 1)) },
        ...extra.map(([, name, value]) => ({ label: `${name} discount`, value: pct(value) })),
        ...(ctx.multiPolicy ? [{ label: 'Multi Policy discount', value: pct(0.9) }] : []),
        ...(ctx.paperless ? [{ label: 'Paperless discount', value: pct(0.97) }] : []),
      ],
    };
  },
};
