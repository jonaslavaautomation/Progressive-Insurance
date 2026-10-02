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
import { PolicyAccount } from '@/servicing/account/PolicyAccount';
import { CarLoading } from '@/components/CarLoading';
import type { CommercialKey, ProductKey } from '@/products/types';
import { CommercialFlow } from '@/commercial/CommercialFlow';
import { PendingList } from '@/servicing/portal/PendingList';
import { CustomerSummary } from '@/servicing/portal/CustomerSummary';
import { ProofCenter } from '@/servicing/portal/ProofCenter';
import { BillingPage, ClaimsPage, CrossSellPage, EsignPage, ProspectsPage } from '@/servicing/portal/ServicePages';
import { AgencyPage, CommissionsPage, NewsPage, ProductGuidesPage, ProductionPage, SupportPage } from '@/servicing/portal/AgencyPages';
import { SessionGuard } from '@/components/SessionGuard';
import { ActivityPage } from '@/servicing/portal/ActivityPage';
import { BookBuilderPage, ExistingQuotesPage, NewQuotePage } from '@/servicing/portal/NewBusinessPages';
import type { PortalPage } from '@/context/quoteStore';

const portalPages: Record<PortalPage, () => JSX.Element> = { newQuote: NewQuotePage, existingQuotes: ExistingQuotesPage, bookBuilder: BookBuilderPage, activity: ActivityPage, billing: BillingPage, esign: EsignPage, claims: ClaimsPage, prospects: ProspectsPage, crossSell: CrossSellPage, productGuides: ProductGuidesPage, agency: AgencyPage, production: ProductionPage, commissions: CommissionsPage, news: NewsPage, support: SupportPage };

// Index matches STEPS in quoteStore.
const stepScreens = [NamedInsuredStep, ProductsStep, HouseholdStep, AdditionalDetailsStep, CoveragesStep, PortfolioStep, PointOfSaleStep, FinalSaleStep];

function Screen() {
  const { state, goToStep, startQuote, startCommercialQuote, openProductPicker, closeProductPicker } = useQuote();
  const modalOpen = state.ui.pickerOpen;
  const setModalOpen = (open: boolean) => (open ? openProductPicker() : closeProductPicker());
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
  if (ui.view === 'account') return <PolicyAccount key={ui.policyId} />;
  if (ui.view === 'commercial' && state.commercial) return <CommercialFlow />;
  if (ui.view === 'pending') return <PendingList />;
  if (ui.view === 'customer') return <CustomerSummary key={ui.customerKey} />;
  if (ui.view === 'proof') return <ProofCenter key={ui.policyId} />;
  const picker = modalOpen && ui.view !== 'dashboard' ? <ProductModal onCancel={() => setModalOpen(false)} onContinue={startNewQuote} onCommercial={startCommercial} /> : null;
  if (ui.view === 'portal') { const Page = portalPages[ui.portalPage]; return <><Page key={ui.portalPage} />{picker}</>; }
  if (ui.view !== 'dashboard') return <Step key={ui.step} />;
  return <><div className="app-zoom"><Dashboard onSelectProduct={() => setModalOpen(true)} onOpenExisting={() => goToStep(ui.step)} existingQuote={existingQuote} showBindingBanner={modalOpen} /></div>{modalOpen && <ProductModal onCancel={() => setModalOpen(false)} onContinue={startNewQuote} onCommercial={startCommercial} />}</>;
}
function App() {
  return <SessionGuard><Screen /><CarLoading /></SessionGuard>;
}
export default App;
