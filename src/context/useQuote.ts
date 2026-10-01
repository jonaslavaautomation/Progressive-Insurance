import { createContext, useContext } from 'react';
import type { AdditionalDetails, AgentProfile, BillPlanQuote, Coverages, Driver, Incident, MailingAddress, NamedInsured, PointOfSale, PolicyInfo, QuoteSummary, RatingResult, SimulatedReports, Vehicle } from '@/types/quote';
import type { QuoteState } from '@/context/quoteStore';
import type { PosOrderResult } from '@/utils/reportSimulator';
import type { OtherProductKey, ProductKey, ProductQuote } from '@/products/types';
import type { PolicyRecord } from '@/types/policy';
import type { PendingTab, PolicyIntent, PolicyQuery, PolicyTab, PortalPage, ProofPage } from '@/context/quoteStore';
import type * as PolicyEngine from '@/services/policyEngine';
import type { CommercialKey } from '@/products/types';
import type { CommercialQuote } from '@/commercial/types';
import type { StateName } from '@/data/states';

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
  /** Starts a fresh quote for the products chosen in Select Product(s). */
  startQuote: (products: ProductKey[]) => void;
  addProducts: (products: ProductKey[]) => void;
  suspendProduct: (key: ProductKey) => void;
  setActiveProduct: (key: ProductKey) => void;
  addUnit: (key: OtherProductKey) => string;
  removeUnit: (key: OtherProductKey, unitId: string) => void;
  updateUnitValues: (key: OtherProductKey, unitId: string, values: Record<string, string>) => void;
  updateUnitCoverages: (key: OtherProductKey, unitId: string, coverages: Record<string, string>) => void;
  updateProduct: (key: OtherProductKey, patch: Partial<Pick<ProductQuote, 'coverages' | 'answers' | 'billPlan' | 'interests'>>) => void;
  advanceClock: (days: number) => void;
  clearPolicies: () => void;
  openPolicies: (query?: Partial<PolicyQuery>) => void;
  openPolicy: (id: string, tab?: PolicyTab, intent?: PolicyIntent) => void;
  openPending: (tab?: PendingTab) => void;
  openCustomer: (customerKey: string) => void;
  openProof: (policyId: string, page?: ProofPage) => void;
  /** Adds the five fictitious reference customers (once). */
  loadPracticeBook: () => void;
  openPage: (page: PortalPage) => void;
  /** New quote for an existing customer, pre-filled from one of their policies. */
  startQuoteFor: (policyId: string, products: ProductKey[]) => void;
  openProductPicker: () => void;
  closeProductPicker: () => void;
  setTrainerMode: (on: boolean) => void;
  /** State for the next new quote (dashboard New Quote card). */
  setQuoteState: (state: StateName) => void;
  /** Confirmation number of the last successful servicing transaction. */
  lastConfirmation: () => string;
  setPolicyTab: (tab: PolicyTab) => void;
  /** Runs a servicing operation on a policy; returns an error message, or '' on success. */
  servicePolicy: (id: string, operation: (policy: PolicyRecord, day: string) => PolicyRecord | string) => string;
  engine: typeof PolicyEngine;
  /** Starts a new Commercial Lines quote and opens it. */
  startCommercialQuote: (products: CommercialKey[]) => void;
  updateCommercial: (update: (quote: CommercialQuote) => CommercialQuote) => void;
  openCommercial: () => void;
  /** Binds every product on the commercial quote; returns the issued policy ids. */
  bindCommercial: () => string[];
}

export const QuoteContext = createContext<QuoteContextValue | null>(null);

export function useQuote(): QuoteContextValue {
  const value = useContext(QuoteContext);
  if (!value) throw new Error('useQuote must be used inside <QuoteProvider>');
  return value;
}
