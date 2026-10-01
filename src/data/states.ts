// State rules for every state this portal writes: North Carolina plus five states where
// Progressive holds the largest auto market share (Texas, Florida, Wisconsin, New Hampshire,
// Oregon). Coverage minimums, required coverages, notice periods and DMV reporting follow each
// state's law as researched in October 2026. Rate levels are illustrative training values.
import type { CoverageOption } from '@/data/options';

export type StateName = 'North Carolina' | 'Texas' | 'Florida' | 'Wisconsin' | 'New Hampshire' | 'Oregon';

export interface StateRules {
  name: StateName;
  code: string;
  zip: RegExp;
  zipHint: string;
  /** Sample address used by "Load Practice Customer" in this state. */
  sample: { street: string; city: string; zip: string };
  /** Bodily Injury / Property Damage choices, lowest (state minimum) first. */
  liability: string[];
  minimumText: string;
  /** Uninsured/underinsured motorist rule. */
  um: { choices: string[]; rule: 'required' | 'rejectable' | 'matchLiability'; minimum?: string; text: string };
  /** Personal Injury Protection, when the state has it. */
  pip: null | { choices: string[]; default: string; rule: 'required' | 'rejectable'; text: string };
  /** Medical Payments choices (NH requires at least $1,000 on every policy). */
  medPay: string[];
  /** States that carry Uninsured Motorist Property Damage on the policy. */
  umpd: boolean;
  insuranceRequired: boolean;
  noFault: boolean;
  nonpaymentNoticeDays: number;
  /** Notice for company cancellation (other than nonpayment) and non-renewal. */
  otherNoticeDays: number;
  noticeText: string;
  /** How coverage is reported to the state, if it is. */
  reporting: null | { system: string; text: string };
  /** The plate must be surrendered (or moved) before coverage on a registered vehicle ends. */
  plateSurrender: null | { agency: string; consequence: string };
  idCardTitle: string;
  statuteText: string;
  /** Statewide rate level relative to North Carolina (training value). */
  rateLevel: number;
  /** Lowest-cost ZIP prefixes get a small discount, the metro prefix a surcharge (training values). */
  metroPrefixes: string[];
}

export const STATE_RULES: Record<StateName, StateRules> = {
  'North Carolina': {
    name: 'North Carolina', code: 'NC', zip: /^2[78]\d{3}$/, zipHint: 'NC ZIP codes start with 27 or 28',
    sample: { street: '100 Training Way', city: 'Raleigh', zip: '27604' },
    liability: ['50/100/50', '100/300/100', '250/500/100', '250/500/250'],
    minimumText: 'Bodily Injury 50/100 and Property Damage 50 (since July 1, 2025).',
    um: { choices: ['50/100', '100/300', '250/500'], rule: 'required', minimum: '50/100', text: 'UM/UIM is included and cannot exceed the Bodily Injury limit.' },
    pip: null, medPay: ['None', '1000', '2000', '5000'], umpd: true, insuranceRequired: true, noFault: false,
    nonpaymentNoticeDays: 15, otherNoticeDays: 60, noticeText: '15 days for nonpayment; 60 days for other company cancellations and non-renewals.',
    reporting: { system: 'NC DMV (FS-1)', text: 'The insurer files an electronic FS-1 with NC DMV for every vehicle and when coverage ends.' },
    plateSurrender: { agency: 'NC DMV', consequence: 'NC DMV receives an FS-1 termination, mails an FS-5 notice and can revoke the plate for 30 days.' },
    idCardTitle: 'North Carolina Automobile Liability Insurance Card',
    statuteText: 'North Carolina law (G.S. 20-309) requires owners of registered vehicles to maintain continuous liability insurance. Keep this card in the insured vehicle and show it to a law enforcement officer on request or after an accident.',
    rateLevel: 1, metroPrefixes: ['282', '276'],
  },
  Texas: {
    name: 'Texas', code: 'TX', zip: /^(7[5-9]\d{3}|733\d{2}|885\d{2})$/, zipHint: 'TX ZIP codes start with 75-79',
    sample: { street: '2100 Sample Creek Dr', city: 'Austin', zip: '78704' },
    liability: ['30/60/25', '50/100/50', '100/300/100', '250/500/100', '250/500/250'],
    minimumText: 'Liability 30/60/25.',
    um: { choices: ['Rejected', '30/60', '50/100', '100/300', '250/500'], rule: 'rejectable', minimum: '30/60', text: 'UM/UIM must be offered; it is included unless the customer rejects it in writing.' },
    pip: { choices: ['2500', '5000', '10000', 'Rejected'], default: '2500', rule: 'rejectable', text: 'PIP of at least $2,500 must be offered; it is included unless the customer rejects it in writing.' },
    medPay: ['None', '1000', '2000', '5000'], umpd: false, insuranceRequired: true, noFault: false,
    nonpaymentNoticeDays: 10, otherNoticeDays: 10, noticeText: '10 days for nonpayment and for other cancellations.',
    reporting: { system: 'TexasSure', text: 'Coverage is reported to TexasSure so law enforcement and the county tax office can verify insurance electronically.' },
    plateSurrender: null,
    idCardTitle: 'Texas Liability Insurance Card',
    statuteText: 'Texas law (Transportation Code, Chapter 601) requires proof of financial responsibility in every vehicle. Keep this card in the insured vehicle and show it on request.',
    rateLevel: 1.14, metroPrefixes: ['770', '752', '782'],
  },
  Florida: {
    name: 'Florida', code: 'FL', zip: /^3[2-4]\d{3}$/, zipHint: 'FL ZIP codes start with 32-34',
    sample: { street: '415 Palm Training Ave', city: 'Tampa', zip: '33606' },
    liability: ['PDL10', '10/20/10', '25/50/25', '50/100/50', '100/300/100', '250/500/100'],
    minimumText: 'No-fault state: $10,000 PIP and $10,000 Property Damage Liability. Bodily Injury is optional (repeal bills died in committee in March 2026).',
    um: { choices: ['Rejected', '10/20', '25/50', '50/100', '100/300', '250/500'], rule: 'rejectable', text: 'UM is optional; the customer must reject it in writing or select limits up to the Bodily Injury limit.' },
    pip: { choices: ['10000'], default: '10000', rule: 'required', text: 'Personal Injury Protection of $10,000 is required on every vehicle with four or more wheels.' },
    medPay: ['None', '1000', '2000', '5000'], umpd: false, insuranceRequired: true, noFault: true,
    nonpaymentNoticeDays: 10, otherNoticeDays: 45, noticeText: '10 days for nonpayment; 45 days for other cancellations.',
    reporting: { system: 'FLHSMV', text: 'Policy initiation and cancellation are reported electronically to the Florida Department of Highway Safety and Motor Vehicles.' },
    plateSurrender: { agency: 'a Florida tax collector or FLHSMV service center', consequence: 'FLHSMV sends an insurance letter and suspends the driver license if the plate is still active with no Florida policy on file.' },
    idCardTitle: 'Florida Insurance Identification Card',
    statuteText: 'Florida law (s. 627.733, F.S.) requires Personal Injury Protection and Property Damage Liability on vehicles with four or more wheels. Keep this card in the vehicle.',
    rateLevel: 1.32, metroPrefixes: ['331', '330', '328'],
  },
  Wisconsin: {
    name: 'Wisconsin', code: 'WI', zip: /^5[34]\d{3}$/, zipHint: 'WI ZIP codes start with 53 or 54',
    sample: { street: '820 Lakeview Sample Rd', city: 'Madison', zip: '53704' },
    liability: ['25/50/10', '50/100/50', '100/300/100', '250/500/100', '250/500/250'],
    minimumText: 'Liability 25/50/10 plus Uninsured Motorist 25/50.',
    um: { choices: ['25/50', '50/100', '100/300', '250/500'], rule: 'required', minimum: '25/50', text: 'Uninsured Motorist of at least 25/50 is required.' },
    pip: null, medPay: ['None', '1000', '2000', '5000'], umpd: false, insuranceRequired: true, noFault: false,
    nonpaymentNoticeDays: 10, otherNoticeDays: 10, noticeText: '10 days for nonpayment and for other cancellations.',
    reporting: null, plateSurrender: null,
    idCardTitle: 'Wisconsin Insurance Identification Card',
    statuteText: 'Wisconsin law requires liability and uninsured motorist coverage on vehicles registered in the state. Keep this card in the vehicle and show it on request.',
    rateLevel: 0.84, metroPrefixes: ['532'],
  },
  'New Hampshire': {
    name: 'New Hampshire', code: 'NH', zip: /^03[0-8]\d{2}$/, zipHint: 'NH ZIP codes start with 030-038',
    sample: { street: '64 Granite Sample St', city: 'Manchester', zip: '03104' },
    liability: ['25/50/25', '50/100/50', '100/300/100', '250/500/100', '250/500/250'],
    minimumText: 'Insurance is not required in New Hampshire, but a policy must carry 25/50/25, UM/UIM equal to liability and $1,000 Medical Payments.',
    um: { choices: ['25/50', '50/100', '100/300', '250/500'], rule: 'matchLiability', text: 'UM/UIM is included at limits equal to the Bodily Injury limits.' },
    pip: null, medPay: ['1000', '2000', '5000'], umpd: false, insuranceRequired: false, noFault: false,
    nonpaymentNoticeDays: 10, otherNoticeDays: 45, noticeText: '10 days for nonpayment; 45 days for other cancellations.',
    reporting: null, plateSurrender: null,
    idCardTitle: 'New Hampshire Insurance Identification Card',
    statuteText: 'New Hampshire does not require auto insurance, but this policy meets the state minimums for a motor vehicle liability policy. Keep this card in the vehicle.',
    rateLevel: 0.8, metroPrefixes: ['031'],
  },
  Oregon: {
    name: 'Oregon', code: 'OR', zip: /^97\d{3}$/, zipHint: 'OR ZIP codes start with 97',
    sample: { street: '1450 Cascade Sample Blvd', city: 'Portland', zip: '97206' },
    liability: ['25/50/20', '50/100/50', '100/300/100', '250/500/100', '250/500/250'],
    minimumText: 'Liability 25/50/20, Personal Injury Protection $15,000 and Uninsured Motorist 25/50.',
    um: { choices: ['25/50', '50/100', '100/300', '250/500'], rule: 'required', minimum: '25/50', text: 'Uninsured Motorist of at least 25/50 is required.' },
    pip: { choices: ['15000'], default: '15000', rule: 'required', text: 'Personal Injury Protection of $15,000 is required.' },
    medPay: ['None'], umpd: false, insuranceRequired: true, noFault: false,
    nonpaymentNoticeDays: 10, otherNoticeDays: 30, noticeText: '10 days for nonpayment; 30 days for other cancellations once the policy has been in force 60 days.',
    reporting: null, plateSurrender: null,
    idCardTitle: 'Oregon Insurance Identification Card',
    statuteText: 'Oregon law (ORS 806.060) requires liability, Personal Injury Protection and uninsured motorist coverage. Keep this card in the vehicle and show it on request.',
    rateLevel: 1.06, metroPrefixes: ['972'],
  },
};

export const SUPPORTED_STATES = Object.keys(STATE_RULES) as StateName[];
export const DEFAULT_STATE: StateName = 'North Carolina';

export function rulesFor(state: string | undefined): StateRules {
  return STATE_RULES[(state ?? '') as StateName] ?? STATE_RULES[DEFAULT_STATE];
}

/** The supported state a ZIP belongs to, if any. */
export function stateForZip(zip: string): StateName | null {
  return SUPPORTED_STATES.find((state) => STATE_RULES[state].zip.test(zip)) ?? null;
}

// Coverage choices across all states, priced per vehicle per 6 months (before factors).
export const LIABILITY_OPTIONS: CoverageOption[] = [
  { value: 'PDL10', label: 'Property Damage only ($10,000 PDL)', base: 150 },
  { value: '10/20/10', label: '10/20/10', base: 268 },
  { value: '25/50/10', label: '25/50/10', base: 300 },
  { value: '25/50/20', label: '25/50/20', base: 312 },
  { value: '25/50/25', label: '25/50/25', base: 318 },
  { value: '30/60/25', label: '30/60/25', base: 330 },
  { value: '50/100/50', label: '50/100/50', base: 380 },
  { value: '100/300/100', label: '100/300/100', base: 461 },
  { value: '250/500/100', label: '250/500/100', base: 538 },
  { value: '250/500/250', label: '250/500/250', base: 577 },
];
export const UM_OPTIONS: CoverageOption[] = [
  { value: 'Rejected', label: 'Rejected in writing', base: 0 },
  { value: '10/20', label: '10/20', base: 18 },
  { value: '25/50', label: '25/50', base: 24 },
  { value: '30/60', label: '30/60', base: 27 },
  { value: '50/100', label: '50/100', base: 32 },
  { value: '100/300', label: '100/300', base: 44 },
  { value: '250/500', label: '250/500', base: 57 },
];
export const PIP_OPTIONS: CoverageOption[] = [
  { value: 'Rejected', label: 'Rejected in writing', base: 0 },
  { value: '2500', label: '$2,500', base: 34 },
  { value: '5000', label: '$5,000', base: 52 },
  { value: '10000', label: '$10,000', base: 88 },
  { value: '15000', label: '$15,000', base: 112 },
];

/** Options for a state, in the state's order. */
export function stateOptions(all: CoverageOption[], values: string[]): CoverageOption[] {
  return values.map((value) => all.find((option) => option.value === value)).filter((option): option is CoverageOption => !!option);
}

/** Per-person limit in thousands ('100/300/100' → 100, 'PDL10' → 0, 'Rejected' → 0). */
export const perPersonLimit = (value: string) => (/^\d/.test(value) ? Number(value.split('/')[0]) : 0);
