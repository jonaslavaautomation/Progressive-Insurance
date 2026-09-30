import { createContext, useContext } from 'react';
import type { AdditionalDetails, AgentProfile, BillPlanQuote, Coverages, Driver, Incident, MailingAddress, NamedInsured, PointOfSale, PolicyInfo, QuoteSummary, RatingResult, SimulatedReports, Vehicle } from '@/types/quote';
import type { QuoteState } from '@/context/quoteStore';
import type { PosOrderResult } from '@/utils/reportSimulator';

export interface QuoteContextValue {
  state: QuoteState;
  /** Live rating of the current inputs (shown only while `rated`). */
  rating: RatingResult;
  /** True when the displayed premium matches the current inputs (no RECALCULATE needed). */
  rated: boolean;
  plan: BillPlanQuote;
  summary: QuoteSummary;
  updatePolicy: (patch: Partial<PolicyInfo>) => void;
  updateInsured: (patch: Partial<NamedInsured>) => void;
  updateAddress: (patch: Partial<MailingAddress>) => void;
  addVehicle: () => string;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  removeVehicle: (id: string) => void;
  addDriver: () => string;
  updateDriver: (id: string, patch: Partial<Driver>) => void;
  removeDriver: (id: string) => void;
  addIncident: (driverId: string, patch?: Partial<Incident>) => string;
  updateIncident: (driverId: string, incidentId: string, patch: Partial<Incident>) => void;
  removeIncident: (driverId: string, incidentId: string) => void;
  updateAdditional: (patch: Partial<AdditionalDetails>) => void;
  updateCoverages: (patch: Partial<Coverages>) => void;
  updatePointOfSale: (patch: Partial<PointOfSale>) => void;
  recalculate: () => void;
  updateReports: (patch: Partial<Pick<SimulatedReports, 'orderClue' | 'orderMvr'>>) => void;
  /** Places the POS order; resolves with vendor results, or null if the order was superseded. */
  orderPointOfSale: () => Promise<PosOrderResult | null>;
  applyPosOrder: (result: PosOrderResult, priorSource: 'vendor' | 'insured') => void;
  cancelPosOrder: () => void;
  dismissPremiumChange: () => void;
  bindPolicy: () => void;
  duplicateQuote: () => string;
  updateAgent: (agent: AgentProfile) => void;
  goToStep: (step: number) => void;
  showDashboard: () => void;
  showDocuments: () => void;
  toggleHints: () => void;
  toggleKeyboardHelp: () => void;
  loadSampleQuote: () => void;
  resetQuote: () => void;
}

export const QuoteContext = createContext<QuoteContextValue | null>(null);

export function useQuote(): QuoteContextValue {
  const value = useContext(QuoteContext);
  if (!value) throw new Error('useQuote must be used inside <QuoteProvider>');
  return value;
}
