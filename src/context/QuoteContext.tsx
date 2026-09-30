import { useCallback, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { QuoteSummary } from '@/types/quote';
import { QuoteContext, type QuoteContextValue } from '@/context/useQuote';
import { createDriver, createIncident, createInitialState, createSampleQuote, createVehicle, generateQuoteNumber, policyNumberFor, quoteReducer } from '@/context/quoteStore';
import { rateQuote } from '@/utils/ratingEngine';
import { simulateReports } from '@/utils/reportSimulator';
import { addMonths, formatDate, parseDate } from '@/utils/dates';

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quoteReducer, undefined, createInitialState);
  // Latest state for async callbacks (report ordering) without re-creating them on every keystroke.
  const stateRef = useRef(state);
  stateRef.current = state;

  const rating = useMemo(() => rateQuote(state), [state]);

  const summary = useMemo<QuoteSummary>(() => {
    const effective = parseDate(state.policy.effectiveDate);
    return {
      quoteNumber: state.policy.quoteNumber,
      policyNumber: state.policy.policyNumber,
      effectiveDate: state.policy.effectiveDate,
      expirationDate: effective ? formatDate(addMonths(effective, 12)) : '',
      monthlyPremium: rating.monthlyPremium,
      paidInFullPremium: rating.paidInFullPremium,
      discountsApplied: rating.discountsApplied,
    };
  }, [state.policy, rating]);

  const orderSimulatedReports = useCallback(async () => {
    const requestId = stateRef.current.reports.requestId + 1;
    dispatch({ type: 'reportsOrdered', requestId });
    const reports = await simulateReports(stateRef.current.drivers, requestId);
    dispatch({ type: 'reportsReceived', reports });
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
    calculatePremium: () => rateQuote(stateRef.current),
    orderSimulatedReports,
    bindPolicy: () => {
      const { quoteNumber } = stateRef.current.policy;
      dispatch({ type: 'bindPolicy', policyNumber: policyNumberFor(quoteNumber || generateQuoteNumber()), boundAt: new Date().toLocaleString('en-US') });
    },
    goToStep: (step) => {
      // The carrier assigns a quote number once the named insured is saved.
      if (step > 0 && !stateRef.current.policy.quoteNumber) dispatch({ type: 'updatePolicy', patch: { quoteNumber: generateQuoteNumber() } });
      dispatch({ type: 'navigate', step });
    },
    showDashboard: () => dispatch({ type: 'showDashboard' }),
    toggleHints: () => dispatch({ type: 'toggleHints' }),
    loadSampleQuote: () => dispatch({ type: 'load', data: createSampleQuote(), maxStep: 4 }),
    resetQuote: () => dispatch({ type: 'reset' }),
  }) satisfies Omit<QuoteContextValue, 'state' | 'rating' | 'summary'>, [orderSimulatedReports]);

  const value = useMemo<QuoteContextValue>(() => ({ state, rating, summary, ...actions }), [state, rating, summary, actions]);

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>;
}
