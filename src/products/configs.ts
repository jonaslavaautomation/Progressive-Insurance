// Product definitions for Motorcycle/ATV, Boat/PWC, Motor Home, Travel Trailer and Renters (HO4).
// Base premiums are annual (12-month term) training rates; factors mirror common carrier practice.
import type { AnyProductKey, CommercialKey, CoverageDef, FieldDef, OtherProductKey, ProductConfig, ProductQuote, ProductRateResult, QuestionDef, RateContext, UnitPremium } from '@/products/types';
import { COMMERCIAL_CONFIGS } from '@/commercial/configs';
import { YEAR_CHOICES, YES_NO_CHOICES, band, baseOf, choices, clamp, factor, money, pct, round2 } from '@/products/helpers';

// ------------------------------------------------------------------ shared building blocks

const zipField: FieldDef = { key: 'garagingZip', label: 'Garaging Zip Code:*', type: 'zip', required: true, help: 'Where the unit is kept overnight. For this North Carolina quote the ZIP must start with 27 or 28.' };
const vinField = (label = 'VIN:'): FieldDef => ({ key: 'vin', label, type: 'vin', posRequired: true, help: 'Required before Point of Sale. A 17-character VIN (no I, O or Q).' });

const LIABILITY: CoverageDef = { key: 'bipd', label: 'Bodily Injury & Property Damage:*', type: 'select', scope: 'policy', required: true, default: '100/300/100', options: [] };
const liability = (bases: [number, number, number]): CoverageDef => ({ ...LIABILITY, options: choices([['50/100/50', '50/100/50', bases[0]], ['100/300/100', '100/300/100', bases[1]], ['250/500/100', '250/500/100', bases[2]]]) });
const umbi = (bases: [number, number, number]): CoverageDef => ({ key: 'umbi', label: 'Uninsured/Underinsured Motorist Bodily Injury:*', type: 'select', scope: 'policy', required: true, default: '100/300', options: choices([['50/100', '50/100', bases[0]], ['100/300', '100/300', bases[1]], ['250/500', '250/500', bases[2]]]) });
const medpay = (bases: [number, number, number]): CoverageDef => ({ key: 'medpay', label: 'Medical Payment:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['1000', '$1,000', bases[0]], ['2000', '$2,000', bases[1]], ['5000', '$5,000', bases[2]]]) });
const deductible = (key: 'comp' | 'coll', label: string, list: [string, string, number][]): CoverageDef => ({ key, label, type: 'select', scope: 'unit', required: true, default: list.find(([value]) => value === '500')?.[0] ?? list[1][0], options: choices([['None', 'No Coverage', 0], ...list]) });
const roadside = (base: number, label = 'Roadside Assistance'): CoverageDef => ({ key: 'roadside', label: 'Towing and Labor (Roadside):*', type: 'select', scope: 'unit', required: true, default: 'None', options: choices([['None', 'None', 0], ['Yes', label, base]]) });

function unitRate(ctx: RateContext, quote: ProductQuote, config: { coverages: CoverageDef[] }, perUnit: (unit: ProductQuote['units'][number], base: (key: string) => number) => Record<string, number>, describe: (unit: ProductQuote['units'][number]) => string): UnitPremium[] {
  return quote.units.map((unit) => {
    const base = (key: string) => {
      const def = config.coverages.find((entry) => entry.key === key);
      const value = def?.scope === 'policy' ? quote.coverages[key] : unit.coverages[key];
      return baseOf(def, value ?? '');
    };
    const amounts = Object.fromEntries(Object.entries(perUnit(unit, base)).map(([key, amount]) => [key, round2(amount)]));
    return { unitId: unit.id, label: describe(unit), amounts, total: round2(Object.values(amounts).reduce((sum, amount) => sum + amount, 0)) };
  });
}

function commonDiscounts(ctx: RateContext, quote: ProductQuote, extra: [boolean, string, number][] = []) {
  const list: [boolean, string, number][] = [[ctx.multiPolicy, 'Multi Policy', 0.9], [ctx.paperless, 'Paperless', 0.97], ...extra];
  const applied = list.filter(([on]) => on);
  return { factor: applied.reduce((product, [, , value]) => product * value, 1), names: applied.map(([, name]) => name), factors: applied.map(([, name, value]) => ({ label: `${name} discount`, value: pct(value) })) };
}

function reportFactors(ctx: RateContext) {
  return [
    { label: 'Rating tier', value: ctx.reportsApplied ? pct(ctx.scoreFactor) : 'Preliminary (reports not yet ordered)' },
    ...(ctx.reportsApplied && ctx.mvrFactor !== 1 ? [{ label: 'MVR findings', value: pct(ctx.mvrFactor) }] : []),
  ];
}

const describeVehicle = (unit: ProductQuote['units'][number], fallback: string) => [unit.values.year, unit.values.make, unit.values.model].filter(Boolean).join(' ') || fallback;
const answered = (quote: ProductQuote, key: string) => quote.answers[key] === 'Yes';

// ------------------------------------------------------------------ Motorcycle / ATV

const MC_TYPES = choices(['Street/Standard', 'Cruiser', 'Touring', 'Sport', 'Dirt Bike', 'ATV/UTV', 'Scooter/Moped']);
const MC_MAKES = choices(['Harley-Davidson', 'Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Indian', 'Ducati', 'Triumph', 'Polaris', 'Can-Am', 'Other']);
const motorcycleCoverages: CoverageDef[] = [
  liability([95, 120, 145]),
  umbi([18, 24, 30]),
  medpay([14, 20, 34]),
  deductible('comp', 'Comprehensive Deductible:*', [['250', '$250', 48], ['500', '$500', 38], ['1000', '$1,000', 28]]),
  deductible('coll', 'Collision Deductible:*', [['250', '$250', 190], ['500', '$500', 150], ['1000', '$1,000', 115]]),
  { key: 'cpe', label: 'Custom Parts & Equipment:*', type: 'select', scope: 'unit', required: true, default: '3000', options: choices([['3000', '$3,000 (included)', 0], ['5000', '$5,000', 18], ['10000', '$10,000', 42], ['15000', '$15,000', 66]]), help: 'Covers aftermarket parts and accessories. The first $3,000 is included.' },
  { key: 'contents', label: 'Carried Contents:*', type: 'select', scope: 'unit', required: true, default: 'None', options: choices([['None', 'None', 0], ['1000', '$1,000', 8], ['2000', '$2,000', 14]]) },
  roadside(12),
];

const motorcycle: ProductConfig = {
  key: 'motorcycle', tileLabel: 'MOTORCYCLE/ATV', tabLabel: 'MOTORCYCLE', name: 'Motorcycle/ATV', unitLabel: 'Motorcycle', unitPlural: 'Motorcycles', multiUnit: true, maxUnits: 6, termMonths: 12, motorized: true, usesMvr: true, idField: 'vin', minimumPremium: 75,
  unitFields: [
    { key: 'type', label: 'Motorcycle Type:*', type: 'select', required: true, options: MC_TYPES, help: 'Sport bikes carry the highest liability and collision rates; scooters and ATVs the lowest.' },
    vinField(),
    { key: 'year', label: 'Year:*', type: 'select', required: true, options: YEAR_CHOICES },
    { key: 'make', label: 'Make:*', type: 'select', required: true, options: MC_MAKES },
    { key: 'model', label: 'Model:*', type: 'text', required: true },
    { key: 'cc', label: 'Engine Size (CC):*', type: 'digits', required: true, help: 'Engine displacement in cubic centimeters (e.g. 883, 1200).' },
    { key: 'value', label: 'Market Value:*', type: 'money', required: true, tag: true },
    zipField,
    { key: 'miles', label: 'Annual Miles:*', type: 'select', required: true, options: choices(['Less than 2,000', '2,000 - 4,999', '5,000 - 9,999', '10,000 or more']) },
    { key: 'antiTheft', label: 'Anti-Theft Device:*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
  ],
  coverages: motorcycleCoverages,
  questions: [
    { key: 'racing', label: 'Is any motorcycle used for racing, stunts or track days?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Motorcycles used for racing or track events are not eligible.' },
    { key: 'safetyCourse', label: 'Has the principal operator completed a motorcycle safety course?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
  ],
  describe: (unit) => describeVehicle(unit, 'New Motorcycle'),
  rate(ctx, quote): ProductRateResult {
    const course = answered(quote, 'safetyCourse');
    const discounts = commonDiscounts(ctx, quote, [[course, 'Motorcycle Safety Course', 0.9]]);
    const units = unitRate(ctx, quote, motorcycle, (unit, base) => {
      const v = unit.values;
      const type = factor({ 'Street/Standard': 1, Cruiser: 0.9, Touring: 1.1, Sport: 1.75, 'Dirt Bike': 0.6, 'ATV/UTV': 0.55, 'Scooter/Moped': 0.45 }, v.type);
      const cc = band(Number(v.cc) || 600, [[250, 0.75], [600, 0.9], [1000, 1.1], [1500, 1.2]], 1.3);
      const miles = factor({ 'Less than 2,000': 0.85, '2,000 - 4,999': 1, '5,000 - 9,999': 1.15, '10,000 or more': 1.3 }, v.miles);
      const value = clamp(Math.sqrt((money(v.value) || 10000) / 10000), 0.5, 1.8);
      const territory = ctx.territory(v.garagingZip ?? '');
      const people = ctx.driverFactor * ctx.priorFactor * ctx.scoreFactor * ctx.mvrFactor;
      return {
        bipd: base('bipd') * type * cc * miles * territory * people * discounts.factor,
        umbi: base('umbi') * territory,
        medpay: base('medpay') * type,
        comp: base('comp') * value * territory * (v.antiTheft === 'Yes' ? 0.9 : 1) * ctx.scoreFactor * discounts.factor,
        coll: base('coll') * type * cc * value * miles * people * discounts.factor,
        cpe: base('cpe'), contents: base('contents'), roadside: base('roadside'),
      };
    }, motorcycle.describe);
    return { units, policy: {}, discounts: discounts.names, factors: [...reportFactors(ctx), { label: 'Primary operator factor', value: pct(ctx.driverFactor) }, ...discounts.factors] };
  },
};

// ------------------------------------------------------------------ Boat / PWC

const BOAT_TYPES = choices(['Bass Boat', 'Pontoon', 'Runabout/Bowrider', 'Cabin Cruiser', 'Sailboat', 'Personal Watercraft (PWC)', 'Fishing Boat', 'Jon Boat']);
const boatCoverages: CoverageDef[] = [
  { key: 'liability', label: 'Boat Liability (Combined Single Limit):*', type: 'select', scope: 'policy', required: true, default: '300000', options: choices([['100000', '$100,000', 48], ['300000', '$300,000', 68], ['500000', '$500,000', 85]]) },
  { key: 'uninsured', label: 'Uninsured Boater:*', type: 'select', scope: 'policy', required: true, default: '100000', options: choices([['None', 'None', 0], ['100000', '$100,000', 12], ['300000', '$300,000', 18]]) },
  { key: 'medpay', label: 'Medical Payments:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['1000', '$1,000', 9], ['5000', '$5,000', 20]]) },
  { key: 'valuation', label: 'Physical Damage Valuation:*', type: 'select', scope: 'unit', required: true, default: 'Actual Cash Value', options: choices(['Actual Cash Value', 'Agreed Value']), help: 'Agreed Value pays the stated value for a total loss with no depreciation; Actual Cash Value deducts depreciation.' },
  { key: 'deductible', label: 'Physical Damage Deductible:*', type: 'select', scope: 'unit', required: true, default: '500', options: choices([['None', 'No Physical Damage', 0], ['250', '$250'], ['500', '$500'], ['1000', '$1,000'], ['2500', '$2,500']]) },
  { key: 'effects', label: 'Personal Effects:*', type: 'select', scope: 'unit', required: true, default: '500', options: choices([['500', '$500 (included)', 0], ['1000', '$1,000', 12], ['2500', '$2,500', 26]]) },
  { key: 'towing', label: 'On-Water Towing:*', type: 'select', scope: 'unit', required: true, default: 'None', options: choices([['None', 'None', 0], ['500', '$500', 15], ['1000', '$1,000', 24]]) },
];

const boat: ProductConfig = {
  key: 'boat', tileLabel: 'BOAT/PWC', tabLabel: 'BOAT', name: 'Boat/PWC', unitLabel: 'Boat', unitPlural: 'Boats', multiUnit: true, maxUnits: 6, termMonths: 12, motorized: false, usesMvr: true, idField: 'hin', minimumPremium: 100,
  unitFields: [
    { key: 'type', label: 'Boat Type:*', type: 'select', required: true, options: BOAT_TYPES, help: 'Personal watercraft and high-performance boats carry higher rates.' },
    { key: 'hin', label: 'Hull ID Number (HIN):', type: 'hin', posRequired: true, help: 'The 12-character Hull Identification Number, usually on the transom. Required before Point of Sale.' },
    { key: 'year', label: 'Year:*', type: 'select', required: true, options: YEAR_CHOICES },
    { key: 'make', label: 'Manufacturer:*', type: 'text', required: true },
    { key: 'length', label: 'Length (feet):*', type: 'digits', required: true },
    { key: 'hull', label: 'Hull Material:*', type: 'select', required: true, options: choices(['Fiberglass', 'Aluminum', 'Wood', 'Inflatable']) },
    { key: 'engine', label: 'Engine Type:*', type: 'select', required: true, options: choices(['Outboard', 'Inboard', 'Inboard/Outboard', 'Jet Drive', 'Sail/No Engine']) },
    { key: 'hp', label: 'Total Horsepower:*', type: 'digits', required: true },
    { key: 'speed', label: 'Maximum Speed (mph):*', type: 'digits', required: true },
    { key: 'value', label: 'Boat Value:*', type: 'money', required: true, tag: true },
    { key: 'trailer', label: 'Boat Trailer Included?*', type: 'select', required: true, options: YES_NO_CHOICES },
    { key: 'trailerValue', label: 'Trailer Value:*', type: 'money', required: true, showIf: ({ values }) => values.trailer === 'Yes' },
    { key: 'storage', label: 'Primary Storage:*', type: 'select', required: true, options: choices(['In Water (Marina/Dock)', 'Dry Land/Garage', 'Trailer at Home']) },
    { key: 'navigation', label: 'Navigation Area:*', type: 'select', required: true, options: choices(['Inland Lakes & Rivers', 'Coastal Waters', 'Ocean within 25 miles']) },
    { key: 'experience', label: 'Operator Boating Experience:*', type: 'select', required: true, tag: true, options: choices(['Less than 2 years', '2 to 5 years', 'More than 5 years']) },
    { key: 'garagingZip', label: 'Storage Zip Code:*', type: 'zip', required: true },
  ],
  coverages: boatCoverages,
  questions: [
    { key: 'commercial', label: 'Is any boat used for commercial purposes, charters or rented to others?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Boats used commercially or rented to others are not eligible.' },
    { key: 'safetyCourse', label: 'Has the principal operator completed a boating safety course?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
  ],
  unitRules: (values) => {
    const errors: Record<string, string> = {};
    if (Number(values.speed) > 70) errors.speed = 'Boats capable of more than 70 mph require underwriting review and cannot be quoted here.';
    if (Number(values.length) > 40) errors.length = 'Boats longer than 40 feet are not eligible for this program.';
    return errors;
  },
  describe: (unit) => [unit.values.year, unit.values.make, unit.values.type].filter(Boolean).join(' ') || 'New Boat',
  rate(ctx, quote): ProductRateResult {
    const course = answered(quote, 'safetyCourse');
    const discounts = commonDiscounts(ctx, quote, [[course, 'Boating Safety Course', 0.9]]);
    const units = unitRate(ctx, quote, boat, (unit, base) => {
      const v = unit.values;
      const type = factor({ 'Bass Boat': 1.15, Pontoon: 0.85, 'Runabout/Bowrider': 1, 'Cabin Cruiser': 1.2, Sailboat: 0.8, 'Personal Watercraft (PWC)': 1.45, 'Fishing Boat': 0.95, 'Jon Boat': 0.6 }, v.type);
      const hp = band(Number(v.hp) || 100, [[50, 0.8], [150, 1], [300, 1.2]], 1.45);
      const nav = factor({ 'Inland Lakes & Rivers': 1, 'Coastal Waters': 1.15, 'Ocean within 25 miles': 1.3 }, v.navigation);
      const storage = factor({ 'In Water (Marina/Dock)': 1.1, 'Dry Land/Garage': 0.9, 'Trailer at Home': 0.95 }, v.storage);
      const experience = factor({ 'Less than 2 years': 1.25, '2 to 5 years': 1.1, 'More than 5 years': 1 }, v.experience);
      const ded = unit.coverages.deductible;
      const hullRate = unit.coverages.valuation === 'Agreed Value' ? 0.014 : 0.012;
      const dedFactor = factor({ '250': 1.25, '500': 1.1, '1000': 1, '2500': 0.82 }, ded, 0);
      const people = ctx.driverFactor * ctx.scoreFactor * ctx.mvrFactor;
      return {
        liability: base('liability') * type * hp * nav * people * discounts.factor,
        uninsured: base('uninsured'),
        medpay: base('medpay') * hp,
        hull: ded === 'None' ? 0 : (money(v.value) || 0) * hullRate * dedFactor * type * hp * nav * storage * experience * ctx.scoreFactor * discounts.factor,
        trailer: v.trailer === 'Yes' && ded !== 'None' ? (money(v.trailerValue) || 0) * 0.01 : 0,
        effects: base('effects'), towing: base('towing'),
      };
    }, boat.describe);
    return { units, policy: {}, discounts: discounts.names, factors: [...reportFactors(ctx), ...discounts.factors] };
  },
};

// ------------------------------------------------------------------ Motor Home

const rvExtras = (effects: [number, number, number], roadsideBase: number): CoverageDef[] => [
  { key: 'tlr', label: 'Total Loss Replacement:*', type: 'select', scope: 'unit', required: true, default: 'No', tag: true, options: YES_NO_CHOICES, help: 'Replaces a total loss with a new unit of similar kind. Available for units 5 model years old or newer.' },
  { key: 'effects', label: 'Personal Effects:*', type: 'select', scope: 'unit', required: true, default: '1000', options: choices([['1000', '$1,000 (included)', 0], ['3000', '$3,000', effects[0]], ['5000', '$5,000', effects[1]], ['10000', '$10,000', effects[2]]]) },
  { key: 'emergency', label: 'Emergency Expense:*', type: 'select', scope: 'unit', required: true, default: '750', options: choices([['750', '$750 (included)', 0], ['1000', '$1,000', 6], ['1500', '$1,500', 12]]), help: 'Pays for lodging and transportation when a covered loss happens more than 50 miles from home.' },
  roadside(roadsideBase, 'RV Roadside Assistance'),
];

const motorhome: ProductConfig = {
  key: 'motorhome', tileLabel: 'MOTOR HOME', tabLabel: 'MOTOR HOME', name: 'Motor Home', unitLabel: 'Motor Home', unitPlural: 'Motor Homes', multiUnit: true, maxUnits: 4, termMonths: 12, motorized: true, usesMvr: true, idField: 'vin', minimumPremium: 150,
  unitFields: [
    { key: 'class', label: 'Motor Home Class:*', type: 'select', required: true, options: choices(['Class A', 'Class B', 'Class C']), help: 'Class A: bus-style. Class B: camper van. Class C: built on a truck chassis with a cab-over bunk.' },
    vinField(),
    { key: 'year', label: 'Year:*', type: 'select', required: true, options: YEAR_CHOICES },
    { key: 'make', label: 'Make:*', type: 'select', required: true, options: choices(['Winnebago', 'Thor', 'Fleetwood', 'Jayco', 'Coachmen', 'Tiffin', 'Forest River', 'Newmar', 'Other']) },
    { key: 'model', label: 'Model:*', type: 'text', required: true },
    { key: 'length', label: 'Length (feet):*', type: 'digits', required: true },
    { key: 'value', label: 'Market Value:*', type: 'money', required: true, tag: true },
    zipField,
    { key: 'usage', label: 'Usage:*', type: 'select', required: true, tag: true, options: choices(['Recreational (part-time)', 'Full-Time Residence']), help: 'Full-timers live in the unit 6+ months a year and need Full-Timer’s coverage.' },
    { key: 'days', label: 'Days Used per Year:*', type: 'select', required: true, options: choices(['Less than 30', '30 - 90', '91 - 180', 'More than 180']) },
    { key: 'towing', label: 'Towing a Vehicle Behind?*', type: 'select', required: true, options: YES_NO_CHOICES },
  ],
  coverages: [
    liability([180, 225, 268]),
    umbi([20, 28, 36]),
    medpay([12, 18, 30]),
    deductible('comp', 'Comprehensive Deductible:*', [['250', '$250', 170], ['500', '$500', 140], ['1000', '$1,000', 110]]),
    deductible('coll', 'Collision Deductible:*', [['500', '$500', 380], ['1000', '$1,000', 300], ['2500', '$2,500', 230]]),
    ...rvExtras([18, 30, 55], 24),
  ],
  questions: [
    { key: 'rented', label: 'Is any motor home ever rented or loaned to others for a fee?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Motor homes rented to others (peer-to-peer or rental fleets) are not eligible.' },
  ],
  unitRules: (values): Record<string, string> => (values.usage === 'Full-Time Residence' && values.days === 'Less than 30' ? { days: 'A full-time residence cannot be used less than 30 days per year.' } : {}),
  describe: (unit) => describeVehicle(unit, 'New Motor Home'),
  rate(ctx, quote): ProductRateResult {
    const discounts = commonDiscounts(ctx, quote);
    const units = unitRate(ctx, quote, motorhome, (unit, base) => {
      const v = unit.values;
      const cls = factor({ 'Class A': 1.45, 'Class B': 0.9, 'Class C': 1.1 }, v.class);
      const fullTime = v.usage === 'Full-Time Residence';
      const days = factor({ 'Less than 30': 0.85, '30 - 90': 1, '91 - 180': 1.15, 'More than 180': 1.3 }, v.days);
      const value = clamp(Math.sqrt((money(v.value) || 60000) / 60000), 0.5, 1.9);
      const territory = ctx.territory(v.garagingZip ?? '');
      const people = ctx.driverFactor * ctx.priorFactor * ctx.scoreFactor * ctx.mvrFactor;
      const tlrEligible = ctx.modelYearAge(v.year) <= 5;
      return {
        bipd: base('bipd') * cls * days * (fullTime ? 1.6 : 1) * territory * people * discounts.factor,
        umbi: base('umbi') * territory,
        medpay: base('medpay'),
        comp: base('comp') * value * territory * ctx.scoreFactor * discounts.factor,
        coll: base('coll') * cls * value * days * people * discounts.factor,
        tlr: unit.coverages.tlr === 'Yes' && tlrEligible ? 95 * value : 0,
        fullTimer: fullTime ? 120 : 0,
        effects: base('effects'), emergency: base('emergency'), roadside: base('roadside'),
      };
    }, motorhome.describe);
    return { units, policy: {}, discounts: discounts.names, factors: [...reportFactors(ctx), { label: 'Primary operator factor', value: pct(ctx.driverFactor) }, ...discounts.factors] };
  },
};

// ------------------------------------------------------------------ Travel Trailer

const trailer: ProductConfig = {
  key: 'trailer', tileLabel: 'TRAVEL TRAILER', tabLabel: 'TRAVEL TRAILER', name: 'Travel Trailer', unitLabel: 'Travel Trailer', unitPlural: 'Travel Trailers', multiUnit: true, maxUnits: 4, termMonths: 12, motorized: false, usesMvr: false, idField: 'vin', minimumPremium: 75,
  unitFields: [
    { key: 'type', label: 'Trailer Type:*', type: 'select', required: true, options: choices(['Travel Trailer', 'Fifth Wheel', 'Pop-Up/Folding Camper', 'Toy Hauler', 'Truck Camper']) },
    vinField(),
    { key: 'year', label: 'Year:*', type: 'select', required: true, options: YEAR_CHOICES },
    { key: 'make', label: 'Make:*', type: 'select', required: true, options: choices(['Airstream', 'Forest River', 'Jayco', 'Keystone', 'Grand Design', 'Coachmen', 'Winnebago', 'Other']) },
    { key: 'model', label: 'Model:*', type: 'text', required: true },
    { key: 'length', label: 'Length (feet):*', type: 'digits', required: true },
    { key: 'value', label: 'Market Value:*', type: 'money', required: true, tag: true },
    zipField,
    { key: 'usage', label: 'Usage:*', type: 'select', required: true, tag: true, options: choices(['Recreational', 'Full-Time Residence', 'Stationary/Seasonal Site']) },
    { key: 'towVehicle', label: 'Tow Vehicle:*', type: 'select', required: true, options: ({ autoVehicles }) => [...autoVehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.label })), { value: 'other', label: 'Other vehicle (not on this quote)' }], help: 'Liability while towing comes from the tow vehicle’s auto policy.' },
  ],
  coverages: [
    deductible('comp', 'Comprehensive Deductible:*', [['250', '$250', 60], ['500', '$500', 48], ['1000', '$1,000', 36]]),
    deductible('coll', 'Collision Deductible:*', [['500', '$500', 140], ['1000', '$1,000', 105]]),
    { key: 'vacationLiability', label: 'Vacation Liability:*', type: 'select', scope: 'unit', required: true, default: 'None', options: choices([['None', 'None', 0], ['25000', '$25,000', 10], ['50000', '$50,000', 16]]), help: 'Covers injuries to others at your campsite while the trailer is used as a temporary residence.' },
    ...rvExtras([16, 26, 45], 18),
  ],
  questions: [
    { key: 'rented', label: 'Is any trailer ever rented or loaned to others for a fee?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Trailers rented to others are not eligible.' },
  ],
  describe: (unit) => describeVehicle(unit, 'New Travel Trailer'),
  rate(ctx, quote): ProductRateResult {
    const discounts = commonDiscounts(ctx, quote);
    const units = unitRate(ctx, quote, trailer, (unit, base) => {
      const v = unit.values;
      const type = factor({ 'Travel Trailer': 1, 'Fifth Wheel': 1.15, 'Pop-Up/Folding Camper': 0.6, 'Toy Hauler': 1.1, 'Truck Camper': 0.9 }, v.type);
      const usage = factor({ Recreational: 1, 'Full-Time Residence': 1.5, 'Stationary/Seasonal Site': 0.85 }, v.usage);
      const value = clamp(Math.sqrt((money(v.value) || 25000) / 25000), 0.5, 1.9);
      const territory = ctx.territory(v.garagingZip ?? '');
      const tlrEligible = ctx.modelYearAge(v.year) <= 5;
      return {
        comp: base('comp') * type * value * territory * ctx.scoreFactor * discounts.factor,
        coll: base('coll') * type * value * usage * ctx.scoreFactor * discounts.factor,
        vacationLiability: base('vacationLiability') * usage,
        tlr: unit.coverages.tlr === 'Yes' && tlrEligible ? 55 * value : 0,
        effects: base('effects'), emergency: base('emergency'), roadside: base('roadside'),
      };
    }, trailer.describe);
    return { units, policy: {}, discounts: discounts.names, factors: [...reportFactors(ctx), ...discounts.factors] };
  },
};

// ------------------------------------------------------------------ Renters (HO4)

// Renters (HO4), laid out like the carrier's renters flow: location address and eligibility on
// Products, prior insurance and discounts on Additional Details, package and add-ons on Coverages.
export const RENTERS_PERSONAL_PROPERTY = { min: 5000, max: 150000 };
export const SCHEDULED_CATEGORIES = ['Jewelry', 'Watches', 'Furs', 'Fine Arts', 'Musical Instruments', 'Cameras', 'Silverware', 'Collectibles'];

const rentersCoverages: CoverageDef[] = [
  { key: 'homeShield', label: 'HomeShield R Package:', type: 'select', scope: 'policy', required: true, default: 'No', options: choices([['No', 'Not selected', 0], ['Yes', 'Selected', 45]]), help: 'Bundles Personal Property Replacement Cost, Water Backup ($5,000) and Identity Theft Expense coverage at a package price.' },
  { key: 'liability', label: 'Liability Limit:*', type: 'select', scope: 'policy', required: true, default: '300000', options: choices([['100000', '$100,000', 28], ['300000', '$300,000', 38], ['500000', '$500,000', 48]]) },
  { key: 'medpay', label: 'Medical Payments Limit:*', type: 'select', scope: 'policy', required: true, default: '5000', options: choices([['1000', '$1,000', 4], ['2000', '$2,000', 7], ['5000', '$5,000', 12]]) },
  { key: 'deductible', label: 'All Other Perils:*', type: 'select', scope: 'policy', required: true, default: '250', options: choices([['250', '$250'], ['500', '$500'], ['1000', '$1,000'], ['2500', '$2,500']]) },
  { key: 'jewelry', label: 'Increased Sublimit for Theft of Jewelry, Watches and Furs:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['1000', '$1,000', 12], ['2500', '$2,500', 26], ['5000', '$5,000', 48]]), help: 'Raises the theft limit for jewelry, watches and furs above the standard $1,500.' },
  { key: 'computer', label: 'Home Computer Coverage:*', type: 'select', scope: 'policy', required: true, default: 'None', options: choices([['None', 'None', 0], ['2500', '$2,500', 8], ['5000', '$5,000', 14], ['10000', '$10,000', 25]]), help: 'Covers computers and related equipment for perils not otherwise covered, such as power surges and accidental damage.' },
];

const PRIOR_FACTORS: Record<string, number> = { 'No prior renters insurance': 1.15 };
const CLAIM_FACTORS: Record<string, number> = { '0 Claims': 1, '1 Claim': 1.3, '2 Claims': 1.65 };
const PACKAGE_FACTORS: Record<string, number> = { 'Progressive Auto 25/50': 0.9, 'Progressive Auto 50/100': 0.88, 'Progressive Auto 100/300': 0.86, 'Progressive Auto 250/500': 0.85, 'Other Progressive policy': 0.92 };

const renters: ProductConfig = {
  key: 'renters', tileLabel: 'RENTERS (HO4)', tabLabel: 'RENTERS', name: 'Renters (HO4)', unitLabel: 'Rental Location', unitPlural: 'Rental Locations', multiUnit: false, maxUnits: 1, termMonths: 12, motorized: false, usesMvr: false, minimumPremium: 100,
  unitFields: [
    { key: 'sameAsMailing', label: 'Endorse location address to mailing address on effective date:*', type: 'select', required: true, options: YES_NO_CHOICES, default: 'Yes', help: 'Yes when the customer lives at the rental (the mailing address becomes the location address on the effective date). No when the location is a different address.' },
    { key: 'street', label: 'Address Line 1:*', type: 'text', required: true, showIf: ({ values }) => values.sameAsMailing === 'No' },
    { key: 'street2', label: 'Address Line 2:', type: 'text', showIf: ({ values }) => values.sameAsMailing === 'No' },
    { key: 'city', label: 'City:*', type: 'text', required: true, showIf: ({ values }) => values.sameAsMailing === 'No' },
    { key: 'garagingZip', label: 'Zip Code:*', type: 'zip', required: true, help: 'The location ZIP determines the territory rate. It must be in the quote state.' },
    { key: 'dwelling', label: 'Residence Type:*', type: 'select', required: true, options: choices(['Apartment', 'Condo', 'Single Family', 'Townhouse', 'Duplex', 'Mobile Home']) },
    { key: 'dogBreed', label: 'Ineligible dog breed on premises', type: 'select', options: YES_NO_CHOICES, default: 'No' },
    { key: 'verifiedNone', label: 'I have verified that NONE of these conditions exist', type: 'select', options: YES_NO_CHOICES, default: '' },
    { key: 'personalProperty', label: 'Personal Property:*', type: 'money', required: true, help: 'The total replacement value of the customer’s belongings: furniture, clothing, electronics, kitchen items. Most renters need $15,000-$40,000.' },
  ],
  coverages: rentersCoverages,
  questions: [
    { key: 'priorInsurer', label: 'Prior Renters Insurer:*', type: 'select', required: true, options: choices(['No prior renters insurance', 'Allstate', 'American Family', 'Erie', 'Farmers', 'GEICO', 'Lemonade', 'Liberty Mutual', 'Nationwide', 'Progressive', 'State Farm', 'USAA', 'Other']) },
    { key: 'priorLiability', label: 'Prior Renters Liability Limit:*', type: 'select', required: true, options: choices(['$100,000', '$300,000', '$500,000']), showIf: ({ values }) => !!values.priorInsurer && values.priorInsurer !== 'No prior renters insurance' },
    { key: 'claims', label: 'Reported claims excluding wind, hail, or lightning in the past 3 years:*', type: 'select', required: true, options: choices(['0 Claims', '1 Claim', '2 Claims', '3 or more Claims']), ineligibleIf: '3 or more Claims', ineligibleMessage: 'Applicants with 3 or more claims in the past 3 years are not eligible for Renters.' },
    { key: 'esign', label: 'E-Signature:', type: 'select', options: YES_NO_CHOICES },
    { key: 'packagePolicy', label: 'Package Policy:*', type: 'select', required: true, options: choices(['None', 'Progressive Auto 25/50', 'Progressive Auto 50/100', 'Progressive Auto 100/300', 'Progressive Auto 250/500', 'Other Progressive policy']), help: 'A Progressive auto policy (current or quoted together) earns the package discount.' },
    { key: 'securedSubdivision', label: 'Secured Subdivision:', type: 'select', options: YES_NO_CHOICES, help: 'Gated community or building with a doorman or controlled access.' },
    { key: 'paperless', label: 'Apply Paperless and accept documents and bills delivered through email?*', type: 'select', required: true, options: YES_NO_CHOICES },
  ],
  unitRules: (values): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (values.dogBreed === 'Yes') errors.dogBreed = 'An ineligible dog breed on premises makes this risk ineligible for Renters.';
    else if (values.verifiedNone !== 'Yes') errors.verifiedNone = 'Confirm that none of the ineligible conditions exist.';
    const amount = money(values.personalProperty ?? '');
    if (values.personalProperty && (amount < RENTERS_PERSONAL_PROPERTY.min || amount > RENTERS_PERSONAL_PROPERTY.max)) errors.personalProperty = `Personal Property must be between $${RENTERS_PERSONAL_PROPERTY.min.toLocaleString('en-US')} and $${RENTERS_PERSONAL_PROPERTY.max.toLocaleString('en-US')}.`;
    return errors;
  },
  describe: (unit) => unit.values.dwelling ? `${unit.values.dwelling}${unit.values.garagingZip ? ` · ${unit.values.garagingZip}` : ''}` : 'Rental Location',
  rate(ctx, quote): ProductRateResult {
    const a = quote.answers;
    const packaged = a.packagePolicy && a.packagePolicy !== 'None';
    const discounts = commonDiscounts({ ...ctx, paperless: ctx.paperless || a.paperless === 'Yes', multiPolicy: ctx.multiPolicy && !packaged }, quote, [[!!packaged, 'Package Policy', PACKAGE_FACTORS[a.packagePolicy] ?? 0.9], [a.securedSubdivision === 'Yes', 'Secured Subdivision', 0.95]]);
    const c = quote.coverages;
    const def = (key: string) => rentersCoverages.find((entry) => entry.key === key);
    const units = quote.units.map((unit): UnitPremium => {
      const v = unit.values;
      const dwelling = factor({ Apartment: 1, Condo: 0.95, 'Single Family': 1.12, Townhouse: 1, Duplex: 1.05, 'Mobile Home': 1.3 }, v.dwelling);
      const ded = factor({ '250': 1.15, '500': 1, '1000': 0.88, '2500': 0.75 }, c.deductible);
      const history = (CLAIM_FACTORS[a.claims] ?? 1) * (PRIOR_FACTORS[a.priorInsurer] ?? 1);
      const contents = (money(v.personalProperty ?? '') || 15000) / 1000 * 4.1 * ctx.territory(v.garagingZip ?? '') * dwelling * ded * history * ctx.scoreFactor * discounts.factor;
      const scheduled = parseScheduled(c.scheduled).reduce((sum, item) => sum + item.value / 100 * (item.category === 'Jewelry' || item.category === 'Watches' || item.category === 'Furs' ? 1.4 : 0.6), 0);
      const amounts = {
        personalProperty: round2(contents),
        liability: round2(baseOf(def('liability'), c.liability) * discounts.factor),
        medpay: baseOf(def('medpay'), c.medpay),
        homeShield: baseOf(def('homeShield'), c.homeShield),
        jewelry: baseOf(def('jewelry'), c.jewelry),
        computer: baseOf(def('computer'), c.computer),
        scheduled: round2(scheduled),
      };
      return { unitId: unit.id, label: renters.describe(unit), amounts, total: round2(Object.values(amounts).reduce((sum, amount) => sum + amount, 0)) };
    });
    return { units, policy: {}, discounts: discounts.names, factors: [{ label: 'Claims and prior insurance', value: pct((CLAIM_FACTORS[a.claims] ?? 1) * (PRIOR_FACTORS[a.priorInsurer] ?? 1)) }, ...reportFactors(ctx), ...discounts.factors] };
  },
};

export interface ScheduledItem { id: string; category: string; description: string; value: number }
/** Itemized scheduled personal property is stored on the coverages as JSON. */
export function parseScheduled(text: string | undefined): ScheduledItem[] {
  try { return text ? (JSON.parse(text) as ScheduledItem[]) : []; } catch { return []; }
}

const snowmobile: ProductConfig = {
  key: 'snowmobile', tileLabel: 'SNOWMOBILE', tabLabel: 'SNOWMOBILE', name: 'Snowmobile', unitLabel: 'Snowmobile', unitPlural: 'Snowmobiles', multiUnit: true, maxUnits: 6, termMonths: 12, motorized: true, usesMvr: true, idField: 'vin', minimumPremium: 75,
  unitFields: [
    { key: 'type', label: 'Snowmobile Type:*', type: 'select', required: true, options: choices(['Trail', 'Crossover', 'Mountain', 'Utility', 'Youth']), help: 'Mountain sleds carry the highest physical damage rates; youth sleds the lowest.' },
    vinField(),
    { key: 'year', label: 'Year:*', type: 'select', required: true, options: YEAR_CHOICES },
    { key: 'make', label: 'Make:*', type: 'select', required: true, options: choices(['Arctic Cat', 'Lynx', 'Polaris', 'Ski-Doo', 'Yamaha', 'Other']) },
    { key: 'model', label: 'Model:*', type: 'text', required: true },
    { key: 'cc', label: 'Engine Size (CC):*', type: 'digits', required: true, help: 'Engine displacement in cubic centimeters (e.g. 600, 850).' },
    { key: 'value', label: 'Market Value:*', type: 'money', required: true, tag: true },
    zipField,
    { key: 'storage', label: 'Off-Season Storage:*', type: 'select', required: true, tag: true, options: choices(['Locked garage or shed', 'Enclosed trailer', 'Outdoors / covered']) },
  ],
  coverages: motorcycleCoverages,
  questions: [
    { key: 'racing', label: 'Is any snowmobile used for racing, hill climbs or competitions?*', type: 'select', required: true, options: YES_NO_CHOICES, ineligibleIf: 'Yes', ineligibleMessage: 'Snowmobiles used for racing or competitions are not eligible.' },
    { key: 'safetyCourse', label: 'Has the principal operator completed a snowmobile safety course?*', type: 'select', required: true, tag: true, options: YES_NO_CHOICES },
    { key: 'trailPermit', label: 'Are the snowmobiles registered and trail-permitted in the state?*', type: 'select', required: true, options: YES_NO_CHOICES },
  ],
  describe: (unit) => describeVehicle(unit, 'New Snowmobile'),
  rate(ctx, quote): ProductRateResult {
    const course = answered(quote, 'safetyCourse');
    const discounts = commonDiscounts(ctx, quote, [[course, 'Snowmobile Safety Course', 0.9]]);
    const units = unitRate(ctx, quote, snowmobile, (unit, base) => {
      const v = unit.values;
      const type = factor({ Trail: 1, Crossover: 1.1, Mountain: 1.3, Utility: 0.85, Youth: 0.5 }, v.type);
      const cc = band(Number(v.cc) || 600, [[250, 0.7], [600, 0.95], [850, 1.1]], 1.25);
      const value = clamp(Math.sqrt((money(v.value) || 10000) / 10000), 0.5, 1.8);
      const storage = factor({ 'Locked garage or shed': 0.9, 'Enclosed trailer': 0.95, 'Outdoors / covered': 1.15 }, v.storage);
      const territory = ctx.territory(v.garagingZip ?? '');
      const people = ctx.driverFactor * ctx.priorFactor * ctx.scoreFactor * ctx.mvrFactor;
      // Snowmobiles are ridden a few months a year, so liability is a fraction of a motorcycle's.
      return {
        bipd: base('bipd') * 0.6 * type * cc * territory * people * discounts.factor,
        umbi: base('umbi') * 0.6 * territory,
        medpay: base('medpay') * type,
        comp: base('comp') * value * storage * territory * ctx.scoreFactor * discounts.factor,
        coll: base('coll') * 0.8 * type * cc * value * people * discounts.factor,
        cpe: base('cpe'), contents: base('contents'), roadside: base('roadside'),
      };
    }, snowmobile.describe);
    return { units, policy: {}, discounts: discounts.names, factors: [...reportFactors(ctx), { label: 'Primary operator factor', value: pct(ctx.driverFactor) }, ...discounts.factors] };
  },
};

export const PRODUCT_CONFIGS: Record<OtherProductKey, ProductConfig> = { motorcycle, boat, motorhome, trailer, snowmobile, renters };
export const OTHER_PRODUCTS = Object.keys(PRODUCT_CONFIGS) as OtherProductKey[];

/** Config for any non-Auto product, personal or commercial. */
export function configFor(key: AnyProductKey): ProductConfig | undefined {
  if (key === 'auto') return undefined;
  return (PRODUCT_CONFIGS as Record<string, ProductConfig>)[key] ?? COMMERCIAL_CONFIGS[key as CommercialKey];
}

export function productLabel(key: AnyProductKey): string {
  return key === 'auto' ? 'Auto' : configFor(key)?.name ?? key;
}

export function productTab(key: AnyProductKey): string {
  return key === 'auto' ? 'AUTO' : configFor(key)?.tabLabel ?? key.toUpperCase();
}

export function termMonthsFor(key: AnyProductKey): number {
  return key === 'auto' ? 6 : configFor(key)?.termMonths ?? 12;
}

export function isCommercialKey(key: AnyProductKey): key is CommercialKey {
  return key in COMMERCIAL_CONFIGS;
}

export type { QuestionDef };
