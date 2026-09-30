import { Building2, Car } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { formatCurrency } from '@/utils/masks';
import { vehicleName } from '@/utils/ratingEngine';
import { PRODUCT_CONFIGS, productLabel, productTab } from '@/products/configs';
import { productTotals } from '@/products/engine';
import { PRODUCT_ICONS } from '@/products/icons';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { WizardCard } from '@/components/wizard/primitives';

function PortfolioContent() {
  const { state, rated, summary, goToStep, setActiveProduct } = useQuote();
  const { additional } = state;
  const totals = productTotals(state, rated);
  const allRated = totals.every((entry) => entry.rated);
  const grand = totals.reduce((sum, entry) => sum + entry.plan.total, 0);
  const cell = 'border-b border-[#edf1f3] px-[16px] py-[12px] text-left align-top';
  const units = (key: (typeof totals)[number]['key']) => (key === 'auto' ? state.vehicles.map(vehicleName).join(', ') : state.productQuotes[key]?.units.map((unit) => PRODUCT_CONFIGS[key].describe(unit)).join(', '));
  const recalc = (key: (typeof totals)[number]['key']) => { setActiveProduct(key); goToStep(4); };
  return <div className="w-[990px] space-y-[20px]">
    <WizardCard title="Portfolio" split={false} subtitle={<span className="font-medium">{totals.length} product{totals.length > 1 ? 's' : ''} · Effective {summary.effectiveDate}</span>}>
      <table className="w-full border-collapse text-[14px]"><thead><tr className="text-[12px] uppercase tracking-[.3px] text-[#5c6670]"><th className={cell}>Product</th><th className={cell}>Quote #</th><th className={cell}>Covered</th><th className={cell}>Term</th><th className={cell}>Bill Plan</th><th className={`${cell} text-right`}>Premium</th></tr></thead><tbody>
        {totals.map((entry) => {
          const Icon = entry.key === 'auto' ? Car : PRODUCT_ICONS[entry.key];
          return <tr key={entry.key}><td className={cell}><span className="flex items-center gap-2 font-bold text-[#003865]"><Icon size={20} strokeWidth={1.5} />{productTab(entry.key)}</span></td><td className={cell}>{entry.quoteNumber}</td><td className={`${cell} max-w-[260px]`}>{units(entry.key)}</td><td className={cell}>{entry.termMonths} months</td><td className={cell}>{entry.plan.name}</td><td className={`${cell} text-right font-bold`}>{entry.rated ? formatCurrency(entry.plan.total) : <button type="button" onClick={() => recalc(entry.key)} className="font-bold text-[#c2185b] underline">Recalculate</button>}</td></tr>;
        })}
      </tbody></table>
      <div className="flex items-center justify-end gap-3 px-[16px] py-[12px] text-[14px]"><span className="text-[#5c6670]">Total Portfolio Premium:</span><span className="text-[18px] font-bold">{allRated ? formatCurrency(grand) : '$ --.--'}</span></div>
    </WizardCard>
    <WizardCard title="Bundle Opportunities" split={false}>
      <div className="px-[21px] py-[16px] text-[14px] leading-[21px]">
        {totals.length > 1 && <p className="mb-2">Quoting {totals.map((entry) => productLabel(entry.key)).join(' + ')} together applies the <b>Multi Policy</b> discount to each product.</p>}
        {additional.crossSell.length
          ? <><p>The customer also has or will purchase these products (Multi Policy applied):</p><ul className="mt-2 grid grid-cols-3 gap-2">{additional.crossSell.map((product) => <li key={product} className="flex items-center gap-2 rounded-[3px] border border-[#cfdbe3] px-3 py-2"><Building2 size={17} strokeWidth={1.5} className="text-[#003865]" />{product}</li>)}</ul></>
          : totals.length === 1 && <p>Ask whether the customer rents, or owns a motorcycle, boat or RV. Use <b>ADD PRODUCTS</b> on the Products or Coverages page to quote them together for the <b>Multi Policy</b> discount.</p>}
      </div>
    </WizardCard>
  </div>;
}

export function PortfolioStep() {
  return <WizardLayout><PortfolioContent /></WizardLayout>;
}
