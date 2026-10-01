// Agency quote preferences (New Business › New Quote/Quote Preferences): default coverages applied
// to new quotes, print addresses, agent code descriptions and quote delete preferences.
// Saved in this browser.

export interface DefaultCoverages {
  auto: { bodilyInjuryPd: string; uninsuredMotorist: string; medicalPayments: string; compDeductible: string; collDeductible: string; rental: string; roadside: string };
  renters: { personalProperty: string; liability: string; medpay: string; deductible: string; homeShield: string };
}

export interface QuotePreferences {
  /** null until the agent saves their defaults (the coverage pages prompt for it). */
  defaults: DefaultCoverages | null;
  printAddress: { name: string; street: string; city: string; state: string; zip: string; phone: string; useOnDocuments: boolean };
  agentCodes: { code: string; description: string }[];
  deletePolicy: { days: string; confirm: boolean };
}

const KEY = 'fao-quote-preferences';
export const RECOMMENDED_DEFAULTS: DefaultCoverages = {
  auto: { bodilyInjuryPd: '100/300/100', uninsuredMotorist: '100/300', medicalPayments: 'None', compDeductible: '500', collDeductible: '500', rental: 'None', roadside: 'None' },
  renters: { personalProperty: '25000', liability: '300000', medpay: '5000', deductible: '500', homeShield: 'No' },
};
const EMPTY: QuotePreferences = {
  defaults: null,
  printAddress: { name: '', street: '', city: '', state: '', zip: '', phone: '', useOnDocuments: false },
  agentCodes: [],
  deletePolicy: { days: '90', confirm: true },
};

function load(): QuotePreferences {
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}) }; } catch { return EMPTY; }
}

let preferences = load();
const listeners = new Set<() => void>();

export const preferencesStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => preferences,
};

export function savePreferences(patch: Partial<QuotePreferences>) {
  preferences = { ...preferences, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* storage unavailable */ }
  listeners.forEach((listener) => listener());
}
