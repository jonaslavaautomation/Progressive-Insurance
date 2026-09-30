import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { AgentProfile, QuoteSummary } from '@/types/quote';
import type { PolicyRecord } from '@/types/policy';
import type { OtherProductKey, ProductKey, ProductQuote } from '@/products/types';
import { PRODUCT_CONFIGS } from '@/products/configs';
import { createProductQuote, createUnit } from '@/products/engine';
import { buildCommercialPolicies, buildPolicies, generatePolicyNumber } from '@/services/policyBuilder';
import { createCommercialQuote } from '@/commercial/engine';
import { buildPracticeBook, hasPracticeBook } from '@/services/practiceBook';
import * as engine from '@/services/policyEngine';
import { setClock } from '@/utils/clock';
import { QuoteContext, type QuoteContextValue } from '@/context/useQuote';
import { DEFAULT_AGENT, agentCodeFor, createDriver, createQuoteData, createIncident, createInitialState, createSampleQuote, createVehicle, generateQuoteNumber, policyNumberFor, quoteReducer } from '@/context/quoteStore';
import { TERM_MONTHS, isRated, rateQuote, selectedPlan } from '@/utils/ratingEngine';
import { simulatePosOrder } from '@/utils/reportSimulator';
import { addDays, addMonths, formatDate, parseDate, today } from '@/utils/dates';

const AGENT_KEY = 'fao-training-agent';

// The agent profile is a per-browser convenience; everything works without storage.
function loadAgent(): AgentProfile {
  try {
    const saved = JSON.parse(localStorage.getItem(AGENT_KEY) ?? 'null') as Partial<AgentProfile> | null;
    if (saved?.name) return { ...DEFAULT_AGENT, ...saved };
  } catch { /* storage unavailable */ }
  return DEFAULT_AGENT;
}

function saveAgent(agent: AgentProfile) {
  try { localStorage.setItem(AGENT_KEY, JSON.stringify(agent)); } catch { /* storage unavailable */ }
}

const POLICIES_KEY = 'fao-training-policies-v3';
const TRAINER_KEY = 'fao-trainer-mode';

function loadTrainerMode(): boolean {
  try { return localStorage.getItem(TRAINER_KEY) === 'on'; } catch { return false; }
}

/** Carrier-style transaction confirmation number. */
function confirmationNumber(): string {
  return `${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`;
}

/** Saved training policies. If the saved training date is behind the real date, catch the policies up. */
function loadPolicies(): { policies: PolicyRecord[]; simDate: string } {
  const realToday = formatDate(today());
  try {
    const saved = JSON.parse(localStorage.getItem(POLICIES_KEY) ?? 'null') as { policies?: PolicyRecord[]; simDate?: string } | null;
    if (saved?.policies && saved.simDate && parseDate(saved.simDate)) {
      if (engine.dayDiff(saved.simDate, realToday) > 0) return { policies: saved.policies.map((policy) => engine.advancePolicy(policy, saved.simDate!, realToday)), simDate: realToday };
      return { policies: saved.policies, simDate: saved.simDate };
    }
  } catch { /* storage unavailable or corrupt */ }
  return { policies: [], simDate: realToday };
}

function buildProductQuotes(keys: ProductKey[], zip: string): Partial<Record<OtherProductKey, ProductQuote>> {
  return Object.fromEntries(keys.filter((key): key is OtherProductKey => key !== 'auto').map((key) => [key, createProductQuote(key, generateQuoteNumber(), zip)]));
}

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quoteReducer, undefined, () => {
    const saved = loadPolicies();
    setClock(parseDate(saved.simDate));
    const agent = loadAgent();
    // The agency's reference accounts are always part of the book of business.
    const policies = hasPracticeBook(saved.policies) ? saved.policies : [...buildPracticeBook(agent, agentCodeFor(agent), saved.simDate), ...saved.policies];
    return createInitialState(agent, policies, saved.simDate, loadTrainerMode());
  });
  // Keep "today" everywhere in the app on the training clock.
  setClock(parseDate(state.simDate));
  useEffect(() => {
    try { localStorage.setItem(POLICIES_KEY, JSON.stringify({ policies: state.policies, simDate: state.simDate })); } catch { /* storage unavailable */ }
  }, [state.policies, state.simDate]);
  // Latest state for async callbacks (report ordering) without re-creating them on every keystroke.
  const stateRef = useRef(state);
  stateRef.current = state;
  const confirmationRef = useRef('');

  const rating = useMemo(() => rateQuote(state), [state]);
  const rated = useMemo(() => isRated(state), [state]);
  const plan = selectedPlan(rating, state.pointOfSale.billPlan);

  const summary = useMemo<QuoteSummary>(() => {
    const effective = parseDate(state.policy.effectiveDate);
    return {
      quoteNumber: state.policy.quoteNumber,
      policyNumber: state.policy.policyNumber,
      effectiveDate: state.policy.effectiveDate,
      expirationDate: effective ? formatDate(addMonths(effective, TERM_MONTHS)) : '',
      totalPremium: plan.total,
      billPlanName: plan.name,
      discountsApplied: rating.appliedDiscounts,
    };
  }, [state.policy, plan, rating]);

  const orderPointOfSale = useCallback(async () => {
    const requestId = stateRef.current.reports.requestId + 1;
    dispatch({ type: 'posOrderStarted', requestId });
    const result = await simulatePosOrder(stateRef.current, requestId);
    return stateRef.current.reports.requestId === requestId ? result : null;
  }, []);

  const actions = useMemo(() => ({
    updatePolicy: (patch) => dispatch({ type: 'updatePolicy', patch }),
    updateInsured: (patch) => dispatch({ type: 'updateInsured', patch }),
    updateAddress: (patch) => dispatch({ type: 'updateAddress', patch }),
    addVehicle: () => {
      const vehicle = createVehicle(stateRef.current.insured.address.zip);
      dispatch({ type: 'addVehicle', vehicle });
      return vehicle.id;
    },
    updateVehicle: (id, patch) => dispatch({ type: 'updateVehicle', id, patch }),
    removeVehicle: (id) => dispatch({ type: 'removeVehicle', id }),
    addDriver: () => {
      const driver = createDriver();
      dispatch({ type: 'addDriver', driver });
      return driver.id;
    },
    updateDriver: (id, patch) => dispatch({ type: 'updateDriver', id, patch }),
    removeDriver: (id) => dispatch({ type: 'removeDriver', id }),
    addIncident: (driverId, patch = {}) => {
      const incident = { ...createIncident(), ...patch };
      dispatch({ type: 'addIncident', driverId, incident });
      return incident.id;
    },
    updateIncident: (driverId, incidentId, patch) => dispatch({ type: 'updateIncident', driverId, incidentId, patch }),
    removeIncident: (driverId, incidentId) => dispatch({ type: 'removeIncident', driverId, incidentId }),
    updateAdditional: (patch) => dispatch({ type: 'updateAdditional', patch }),
    updateCoverages: (patch) => dispatch({ type: 'updateCoverages', patch }),
    updatePointOfSale: (patch) => dispatch({ type: 'updatePointOfSale', patch }),
    recalculate: () => dispatch({ type: 'recalculate' }),
    updateReports: (patch) => dispatch({ type: 'updateReports', patch }),
    orderPointOfSale,
    applyPosOrder: (result, priorSource) => dispatch({ type: 'posOrderApplied', result, priorSource }),
    cancelPosOrder: () => dispatch({ type: 'posOrderCancelled' }),
    dismissPremiumChange: () => dispatch({ type: 'dismissPremiumChange' }),
    bindPolicy: () => {
      // Binding issues one policy per product on the quote, each with its own policy number and bill.
      const current = stateRef.current;
      const numbers: Partial<Record<ProductKey, string>> = { auto: policyNumberFor(current.policy.quoteNumber || generateQuoteNumber()) };
      for (const key of current.products) if (key !== 'auto') numbers[key] = generatePolicyNumber();
      const records = buildPolicies(current, rateQuote(current), isRated(current), current.agent.name, current.simDate, numbers);
      dispatch({ type: 'policiesIssued', records, boundAt: `${current.simDate} ${new Date().toLocaleTimeString('en-US')}` });
    },
    startQuote: (products) => {
      const zip = '';
      dispatch({ type: 'startQuote', products, productQuotes: buildProductQuotes(products, zip) });
    },
    addProducts: (products) => {
      const current = stateRef.current;
      const fresh = products.filter((key) => !current.products.includes(key));
      if (!fresh.length) return;
      if (fresh.includes('auto') && !current.policy.quoteNumber) dispatch({ type: 'updatePolicy', patch: { quoteNumber: generateQuoteNumber() } });
      dispatch({ type: 'addProducts', products: fresh, productQuotes: buildProductQuotes(fresh, current.insured.address.zip) });
    },
    suspendProduct: (key) => dispatch({ type: 'suspendProduct', key }),
    setActiveProduct: (key) => dispatch({ type: 'setActiveProduct', key }),
    addUnit: (key) => {
      const unit = createUnit(PRODUCT_CONFIGS[key], stateRef.current.insured.address.zip);
      dispatch({ type: 'addUnit', key, unit });
      return unit.id;
    },
    removeUnit: (key, unitId) => dispatch({ type: 'removeUnit', key, unitId }),
    updateUnitValues: (key, unitId, values) => dispatch({ type: 'updateUnit', key, unitId, values }),
    updateUnitCoverages: (key, unitId, coverages) => dispatch({ type: 'updateUnit', key, unitId, coverages }),
    updateProduct: (key, patch) => dispatch({ type: 'updateProduct', key, patch }),
    advanceClock: (days) => dispatch({ type: 'advanceClock', to: formatDate(addDays(parseDate(stateRef.current.simDate) ?? today(), days)) }),
    clearPolicies: () => {
      // Resets the book of business to the reference accounts.
      const current = stateRef.current;
      dispatch({ type: 'clearPolicies' });
      dispatch({ type: 'policiesSeeded', records: buildPracticeBook(current.agent, agentCodeFor(current.agent), current.simDate) });
    },
    openPolicies: (query) => dispatch({ type: 'openPolicies', query }),
    openPolicy: (id, tab, intent) => dispatch({ type: 'openPolicy', id, tab, intent }),
    openPending: (tab) => dispatch({ type: 'openPortal', view: 'pending', tab }),
    openCustomer: (customerKey) => dispatch({ type: 'openPortal', view: 'customer', customerKey }),
    openProof: (policyId, page) => dispatch({ type: 'openPortal', view: 'proof', policyId, page }),
    openPage: (page) => dispatch({ type: 'openPage', page }),
    startQuoteFor: (policyId, products) => {
      const current = stateRef.current;
      const policy = current.policies.find((entry) => entry.id === policyId);
      if (!policy || policy.source.kind !== 'personal') return;
      const source = JSON.parse(JSON.stringify(policy.source.quote)) as typeof policy.source.quote;
      const fresh = createQuoteData(current.agent);
      dispatch({ type: 'startQuote', products, productQuotes: buildProductQuotes(products, source.insured.address.zip) });
      dispatch({ type: 'load', maxStep: 0, data: { ...source, policy: { ...fresh.policy, quoteNumber: generateQuoteNumber() }, pointOfSale: fresh.pointOfSale, ratedSignature: '', premiumChange: null, products, productQuotes: {} } });
    },
    openProductPicker: () => dispatch({ type: 'setPicker', open: true }),
    closeProductPicker: () => dispatch({ type: 'setPicker', open: false }),
    setTrainerMode: (on) => {
      try { localStorage.setItem(TRAINER_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
      dispatch({ type: 'setTrainerMode', on });
    },
    lastConfirmation: () => confirmationRef.current,
    loadPracticeBook: () => {
      const current = stateRef.current;
      if (hasPracticeBook(current.policies)) return;
      dispatch({ type: 'policiesSeeded', records: buildPracticeBook(current.agent, agentCodeFor(current.agent), current.simDate) });
    },
    setPolicyTab: (tab) => dispatch({ type: 'setPolicyTab', tab }),
    servicePolicy: (id, operation) => {
      const current = stateRef.current;
      const record = current.policies.find((entry) => entry.id === id);
      if (!record) return 'Policy not found.';
      const result = operation(record, current.simDate);
      if (typeof result === 'string') return result;
      // Every servicing transaction gets a confirmation number, recorded on its history entries.
      const confirmation = confirmationNumber();
      confirmationRef.current = confirmation;
      const known = new Set(record.history.map((entry) => entry.id));
      dispatch({ type: 'updatePolicyRecord', record: { ...result, history: result.history.map((entry) => (known.has(entry.id) ? entry : { ...entry, detail: `${entry.detail} Confirmation #${confirmation}.` })) } });
      return '';
    },
    duplicateQuote: () => {
      const quoteNumber = generateQuoteNumber();
      dispatch({ type: 'duplicateQuote', quoteNumber });
      return quoteNumber;
    },
    updateAgent: (agent) => { saveAgent(agent); dispatch({ type: 'updateAgent', agent }); },
    goToStep: (step) => {
      // The carrier assigns a quote number once the named insured is saved.
      if (step > 0 && !stateRef.current.policy.quoteNumber) dispatch({ type: 'updatePolicy', patch: { quoteNumber: generateQuoteNumber() } });
      dispatch({ type: 'navigate', step });
    },
    showDashboard: () => dispatch({ type: 'showDashboard' }),
    showDocuments: () => dispatch({ type: 'showDocuments' }),
    toggleHints: () => dispatch({ type: 'toggleHints' }),
    toggleKeyboardHelp: () => dispatch({ type: 'toggleKeyboardHelp' }),
    loadSampleQuote: () => dispatch({ type: 'load', data: createSampleQuote(stateRef.current.agent), maxStep: 3 }),
    resetQuote: () => dispatch({ type: 'reset' }),
    startCommercialQuote: (products) => dispatch({ type: 'setCommercial', quote: createCommercialQuote(products), show: true }),
    updateCommercial: (update) => {
      const quote = stateRef.current.commercial;
      if (quote) dispatch({ type: 'setCommercial', quote: update(quote) });
    },
    openCommercial: () => { if (stateRef.current.commercial) dispatch({ type: 'setCommercial', quote: stateRef.current.commercial, show: true }); },
    bindCommercial: () => {
      const current = stateRef.current;
      if (!current.commercial || current.commercial.boundPolicyIds.length) return current.commercial?.boundPolicyIds ?? [];
      const records = buildCommercialPolicies(current.commercial, agentCodeFor(current.agent), current.agent.name, current.simDate);
      dispatch({ type: 'commercialIssued', records, quote: { ...current.commercial, boundPolicyIds: records.map((record) => record.id) } });
      return records.map((record) => record.id);
    },
  }) satisfies Omit<QuoteContextValue, 'state' | 'rating' | 'rated' | 'plan' | 'summary' | 'engine'>, [orderPointOfSale]);

  const value = useMemo<QuoteContextValue>(() => ({ state, rating, rated, plan, summary, engine, ...actions }), [state, rating, rated, plan, summary, actions]);

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>;
}
