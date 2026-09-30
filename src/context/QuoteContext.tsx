import { useCallback, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { AgentProfile, QuoteSummary } from '@/types/quote';
import { QuoteContext, type QuoteContextValue } from '@/context/useQuote';
import { DEFAULT_AGENT, createDriver, createIncident, createInitialState, createSampleQuote, createVehicle, generateQuoteNumber, policyNumberFor, quoteReducer } from '@/context/quoteStore';
import { TERM_MONTHS, isRated, rateQuote, selectedPlan } from '@/utils/ratingEngine';
import { simulatePosOrder } from '@/utils/reportSimulator';
import { addMonths, formatDate, parseDate } from '@/utils/dates';

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

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quoteReducer, undefined, () => createInitialState(loadAgent()));
  // Latest state for async callbacks (report ordering) without re-creating them on every keystroke.
  const stateRef = useRef(state);
  stateRef.current = state;

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
      const { quoteNumber } = stateRef.current.policy;
      dispatch({ type: 'bindPolicy', policyNumber: policyNumberFor(quoteNumber || generateQuoteNumber()), boundAt: new Date().toLocaleString('en-US') });
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
  }) satisfies Omit<QuoteContextValue, 'state' | 'rating' | 'rated' | 'plan' | 'summary'>, [orderPointOfSale]);

  const value = useMemo<QuoteContextValue>(() => ({ state, rating, rated, plan, summary, ...actions }), [state, rating, rated, plan, summary, actions]);

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>;
}
