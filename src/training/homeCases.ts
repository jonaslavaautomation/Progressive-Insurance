// Practice quote cases for VA training: each case pairs an intake form (PDF) with the entries that
// produce the correct premium. The check rates the trainee's quote and the correct entries with the
// same rating engine, so the expected premium follows the training clock and Trainer Mode settings.
import type { QuoteData } from '@/types/quote';
import type { OtherProductKey } from '@/products/types';
import { PRODUCT_CONFIGS } from '@/products/configs';
import { isProductRated, rateProduct } from '@/products/engine';

export interface PracticeCase {
  id: string;
  title: string;
  summary: string;
  pdf: string;
  product: OtherProductKey;
  quoteState: string;
  insured: { firstName: string; lastName: string; zip: string };
  values: Record<string, string>;
  coverages: Record<string, string>;
  answers: Record<string, string>;
  /** Coverage values the task allows besides the expected one (e.g. a re-quote at a higher limit). */
  alternatives?: Record<string, string[]>;
  billPlan: string;
  bundle: boolean;
  paperless: 'Yes' | 'No';
}

const PROTECTED = 'Protected (hydrant within 1,000 ft, fire station within 5 miles)';

export const PRACTICE_CASES: PracticeCase[] = [
  {
    id: 'PG-HO-1', title: 'PG-HO-1: Caldwell (HO3, escrow)', pdf: '/training/PG-HO-1-Caldwell-NC.pdf', product: 'homeowners', quoteState: 'North Carolina',
    summary: 'Owner-occupied 1995 frame home in Raleigh. Home + auto bundle, alarm, escrow billing. Re-quote with $500,000 liability.',
    insured: { firstName: 'Brandon', lastName: 'Caldwell', zip: '27615' },
    values: { garagingZip: '27615', yearBuilt: '1995', squareFeet: '2260', construction: 'Frame', stories: '2', roofType: 'Architectural Shingle', roofYear: '2017', protection: PROTECTED, alarm: 'Yes', dwellingValue: '640000' },
    coverages: { otherStructures: '10', personalProperty: '50', liability: '300000', medpay: '5000', deductible: '1000', windDeductible: 'Same', rcContents: 'Yes', waterBackup: '10000' },
    answers: { priorInsurer: 'Other', claims: '0 Claims', occupancy: 'No', hazards: 'No', mortgageeBilled: 'Yes' },
    alternatives: { liability: ['500000'] },
    billPlan: 'PIF', bundle: true, paperless: 'No',
  },
  {
    id: 'PG-HO-2', title: 'PG-HO-2: Petrova (HO3, non-renewed)', pdf: '/training/PG-HO-2-Petrova-NC.pdf', product: 'homeowners', quoteState: 'North Carolina',
    summary: 'Older ranch home in Fayetteville, non-renewed for roof age. One water claim, fenced pool, monthly EFT, no mortgage.',
    insured: { firstName: 'Rosalind', lastName: 'Petrova', zip: '28303' },
    values: { garagingZip: '28303', yearBuilt: '1968', squareFeet: '1820', construction: 'Frame', stories: '1', roofType: 'Asphalt Shingle', roofYear: '2004', protection: PROTECTED, alarm: 'No', dwellingValue: '425000' },
    coverages: { otherStructures: '10', personalProperty: '50', liability: '300000', medpay: '5000', deductible: '2500', windDeductible: 'Same', rcContents: 'Yes', waterBackup: '5000' },
    answers: { priorInsurer: 'Other', claims: '1 Claim', occupancy: 'No', hazards: 'No', mortgageeBilled: 'No' },
    billPlan: 'EFT', bundle: true, paperless: 'No',
  },
];

export const practiceCase = (id?: string) => PRACTICE_CASES.find((entry) => entry.id === id);

/** Where to look on the intake form for each entry, without giving away the answer. */
const HINTS: Record<string, string> = {
  garagingZip: 'Dwelling ZIP code: use the property address on the intake form.',
  yearBuilt: 'Year Built: check Dwelling Information.',
  squareFeet: 'Living Area: use the square footage in Dwelling Information.',
  construction: 'Construction Type: check Dwelling Information.',
  stories: 'Number of Stories: check Dwelling Information.',
  roofType: 'Roof Material: match the main roof material (3-tab composition is Asphalt Shingle; architectural composition is Architectural Shingle).',
  roofYear: 'Year Roof Installed or Replaced: use the year the roof was replaced, not the year the home was built.',
  protection: 'Fire Protection: use the fire hydrant and fire station distances in Protection & Safety.',
  alarm: 'Central Station Alarm: check the burglar and fire alarm entries.',
  dwellingValue: 'Coverage A (Dwelling): use the rebuild cost in Coverage Requested, not the purchase price (land is not insured).',
  otherStructures: 'Other Structures (Coverage B): check Coverage Requested.',
  personalProperty: 'Personal Property (Coverage C): check the percentage of Coverage A in Coverage Requested.',
  liability: 'Personal Liability (Coverage E): check Coverage Requested.',
  medpay: 'Medical Payments (Coverage F): check Coverage Requested.',
  deductible: 'All Other Perils Deductible: check the All-Peril Deductible in Coverage Requested.',
  windDeductible: 'Wind/Hail Deductible: check Coverage Requested.',
  rcContents: 'Personal Property Replacement Cost: check Replacement Cost - Contents.',
  waterBackup: 'Water Backup and Sump Overflow: check Optional Endorsements.',
  priorInsurer: 'Prior Homeowners Insurer: the prior carrier is not in the list, so choose Other. "No prior homeowners insurance" adds a surcharge.',
  claims: 'Property claims: count the losses in Loss History (last 5 years).',
  occupancy: 'Rented, vacant, under construction or business use: check the underwriting answers (short trips are not vacancy).',
  hazards: 'Pool, trampoline or dog breed: a fenced pool with no diving board does not make the home ineligible.',
  mortgageeBilled: 'Escrow: check the Payment Plan and Mortgagee sections.',
};

const formatMoney = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const digits = (value: string | undefined) => (value ?? '').replace(/[^0-9]/g, '');
const same = (key: string, a: string | undefined, b: string | undefined) => (['dwellingValue', 'squareFeet', 'yearBuilt', 'roofYear', 'garagingZip'].includes(key) ? digits(a) === digits(b) : (a ?? '') === (b ?? ''));

export interface PracticeResult {
  rated: boolean;
  correct: boolean;
  premium: number;
  expected: number;
  /** Entries that change the premium. */
  problems: string[];
  /** Entries that do not change the premium but do not match the intake form. */
  notes: string[];
  scenario: string;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Grades a practice quote: the premium must match what the correct entries produce. */
export function checkPracticeQuote(quote: QuoteData, kase: PracticeCase): PracticeResult {
  const key = kase.product;
  const product = quote.productQuotes[key];
  const label = PRODUCT_CONFIGS[key].name;
  if (!product || !quote.products.includes(key)) return { rated: false, correct: false, premium: 0, expected: 0, problems: [`Add ${label} to the quote.`], notes: [], scenario: '' };
  const rated = isProductRated(key, quote);
  const planTotal = (q: QuoteData) => { const rating = rateProduct(key, q); return (rating.billPlans.find((plan) => plan.id === q.productQuotes[key]!.billPlan) ?? rating.billPlans[0]).total; };

  // The correct quote: the trainee's quote with every graded entry set to the intake form's value.
  const coverages = { ...kase.coverages };
  for (const [field, allowed] of Object.entries(kase.alternatives ?? {})) if (allowed.includes(product.coverages[field] ?? '')) coverages[field] = product.coverages[field];
  const correct = clone(quote);
  const target = correct.productQuotes[key]!;
  target.units[0].values = { ...target.units[0].values, ...kase.values };
  target.coverages = { ...target.coverages, ...coverages };
  target.answers = { ...target.answers, ...kase.answers };
  target.billPlan = kase.billPlan as typeof target.billPlan;
  correct.additional = { ...correct.additional, paperless: kase.paperless, crossSell: kase.bundle && !correct.additional.crossSell.includes('Auto') ? [...correct.additional.crossSell, 'Auto'] : correct.additional.crossSell };
  const expected = planTotal(correct);
  const premium = planTotal(quote);

  const config = PRODUCT_CONFIGS[key];
  const unit = product.units[0]?.values ?? {};
  const problems: string[] = [];
  const check = (field: string, entered: string | undefined, wanted: string) => { if (!same(field, entered, wanted)) problems.push(HINTS[field] ?? `${field}: check the intake form.`); };
  for (const field of config.unitFields) if (field.key in kase.values) check(field.key, unit[field.key], kase.values[field.key]);
  for (const coverage of config.coverages) if (coverage.key in coverages) check(coverage.key, product.coverages[coverage.key], coverages[coverage.key]);
  for (const question of config.questions) if (question.key in kase.answers) check(question.key, product.answers[question.key], kase.answers[question.key]);
  if (kase.bundle && !quote.additional.crossSell.includes('Auto') && !quote.products.includes('auto')) problems.push('Bundle: the customer wants home + auto. Mark Auto as a cross-sell product on Additional Details so the multi-policy discount applies.');
  if (quote.additional.paperless !== kase.paperless) problems.push(`Paperless: the intake form says documents are ${kase.paperless === 'No' ? 'mailed, so answer No' : 'delivered electronically'}.`);
  if (product.billPlan !== kase.billPlan) problems.push(kase.billPlan === 'PIF' ? 'Bill plan: escrow billing is paid in full by the mortgage company. Select Pay In Full.' : 'Bill plan: the customer pays monthly from checking. Select Pay With EFT.');

  const notes: string[] = [];
  if (quote.policy.quoteState !== kase.quoteState) notes.push(`Quote state: this case is quoted in ${kase.quoteState}.`);
  if (quote.insured.firstName.trim().toLowerCase() !== kase.insured.firstName.toLowerCase() || quote.insured.lastName.trim().toLowerCase() !== kase.insured.lastName.toLowerCase()) notes.push(`Named insured: enter ${kase.insured.firstName} ${kase.insured.lastName} as on the intake form.`);
  if (digits(quote.insured.address.zip) !== kase.insured.zip) notes.push('Mailing address: use the address on the intake form.');

  const liability = Number(coverages.liability ?? 0);
  const scenario = kase.alternatives?.liability && liability ? `Liability $${liability.toLocaleString('en-US')}` : '';
  return { rated, correct: rated && Math.abs(premium - expected) < 0.005 && !problems.length, premium, expected, problems, notes, scenario };
}

/** The validation message shown when a practice quote's premium is wrong (blocks continuing past Coverages). */
export function practiceError(quote: QuoteData): string {
  const kase = practiceCase(quote.policy.trainingCase);
  if (!kase) return '';
  const result = checkPracticeQuote(quote, kase);
  if (!result.rated || result.correct) return '';
  return `Practice case ${kase.id}: incorrect premium (${formatMoney(result.premium)}). Fix the ${result.problems.length === 1 ? 'entry' : `${result.problems.length} entries`} listed in the practice case panel above, click RECALCULATE, then continue.`;
}
