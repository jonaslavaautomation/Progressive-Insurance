import { useState } from 'react';
import { useQuote } from '@/context/useQuote';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { ProductModal } from '@/components/ProductModal';
import { NamedInsuredStep } from '@/steps/NamedInsuredStep';
import { ProductsStep } from '@/steps/ProductsStep';
import { HouseholdStep } from '@/steps/HouseholdStep';
import { AdditionalDetailsStep } from '@/steps/AdditionalDetailsStep';
import { CoveragesStep } from '@/steps/CoveragesStep';
import { PortfolioStep } from '@/steps/PortfolioStep';
import { PointOfSaleStep } from '@/steps/PointOfSaleStep';
import { FinalSaleStep } from '@/steps/FinalSaleStep';
import { DocumentCenter } from '@/components/DocumentCenter';
import { PolicySearch } from '@/servicing/PolicySearch';
import { PolicyView } from '@/servicing/PolicyView';
import type { CommercialKey, ProductKey } from '@/products/types';
import { CommercialFlow } from '@/commercial/CommercialFlow';

// Index matches STEPS in quoteStore.
const stepScreens = [NamedInsuredStep, ProductsStep, HouseholdStep, AdditionalDetailsStep, CoveragesStep, PortfolioStep, PointOfSaleStep, FinalSaleStep];

function App() {
  const { state, goToStep, startQuote, startCommercialQuote } = useQuote();
  const [modalOpen, setModalOpen] = useState(false);
  const { ui, policy, insured } = state;
  const hasQuote = ui.maxStep > 0 || Boolean(insured.firstName || insured.lastName);
  const customer = [insured.firstName, insured.lastName].filter(Boolean).join(' ') || 'New Customer';
  const existingQuote = hasQuote ? `${policy.quoteNumber || 'In progress'} - ${customer}` : '';

  const startNewQuote = (products: ProductKey[]) => {
    if (hasQuote && !state.policy.policyNumber && !window.confirm(`Start a new quote? The in-progress quote for ${customer} will be discarded.`)) return;
    setModalOpen(false);
    startQuote(products);
  };

  const startCommercial = (products: CommercialKey[]) => {
    const current = state.commercial;
    if (current && !current.boundPolicyIds.length && current.business.name && !window.confirm(`Start a new commercial quote? The in-progress quote for ${current.business.name} will be discarded.`)) return;
    setModalOpen(false);
    startCommercialQuote(products);
  };

  const Step = stepScreens[ui.step];
  // The dashboard keeps its scaled layout; the quote wizard renders 1:1 at the carrier's native sizes.
  if (ui.view === 'documents') return <DocumentCenter />;
  if (ui.view === 'policies') return <PolicySearch />;
  if (ui.view === 'policy') return <PolicyView key={ui.policyId} />;
  if (ui.view === 'commercial' && state.commercial) return <CommercialFlow />;
  if (ui.view !== 'dashboard') return <Step key={ui.step} />;
  return <div className="app-zoom"><Dashboard onSelectProduct={() => setModalOpen(true)} onOpenExisting={() => goToStep(ui.step)} existingQuote={existingQuote} showBindingBanner={modalOpen} />{modalOpen && <ProductModal onCancel={() => setModalOpen(false)} onContinue={startNewQuote} onCommercial={startCommercial} />}</div>;
}
export default App;
