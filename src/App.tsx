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

// Index matches STEPS in quoteStore.
const stepScreens = [NamedInsuredStep, ProductsStep, HouseholdStep, AdditionalDetailsStep, CoveragesStep, PortfolioStep, PointOfSaleStep, FinalSaleStep];

function App() {
  const { state, goToStep, resetQuote } = useQuote();
  const [modalOpen, setModalOpen] = useState(false);
  const { ui, policy, insured } = state;
  const hasQuote = ui.maxStep > 0 || Boolean(insured.firstName || insured.lastName);
  const customer = [insured.firstName, insured.lastName].filter(Boolean).join(' ') || 'New Customer';
  const existingQuote = hasQuote ? `${policy.quoteNumber || 'In progress'} - ${customer}` : '';

  const startNewQuote = () => {
    if (hasQuote && !window.confirm(`Start a new quote? The in-progress quote for ${customer} will be discarded.`)) return;
    if (hasQuote) resetQuote();
    setModalOpen(false);
    goToStep(0);
  };

  const Step = stepScreens[ui.step];
  return <div className="app-zoom">{ui.view === 'dashboard' ? <><Dashboard onSelectProduct={() => setModalOpen(true)} onOpenExisting={() => goToStep(ui.step)} existingQuote={existingQuote} />{modalOpen && <ProductModal onCancel={() => setModalOpen(false)} onContinue={startNewQuote} />}</> : <Step key={ui.step} />}</div>;
}
export default App;
