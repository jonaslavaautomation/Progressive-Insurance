import { createContext, useContext } from 'react';
import type { AdditionalDetails, Coverages, Driver, Incident, MailingAddress, NamedInsured, PointOfSale, PolicyInfo, QuoteSummary, RatingResult, Vehicle } from '@/types/quote';
import type { QuoteState } from '@/context/quoteStore';

export interface QuoteContextValue {
  state: QuoteState;
  rating: RatingResult;
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
  calculatePremium: () => RatingResult;
  orderSimulatedReports: () => Promise<void>;
  bindPolicy: () => void;
  goToStep: (step: number) => void;
  showDashboard: () => void;
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
