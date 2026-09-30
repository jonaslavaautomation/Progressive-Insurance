import { Building2, Car } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { formatCurrency } from '@/utils/masks';
import { TERM_MONTHS, vehicleName } from '@/utils/ratingEngine';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { WizardCard } from '@/components/wizard/primitives';

function PortfolioContent() {
  const { state, rated, plan, summary, goToStep } = useQuote();
  const { additional } = state;
  const cell = 'border-b border-[#edf1f3] px-[16px] py-[12px] text-left';
  return <div className="w-[880px] space-y-[20px]">
    <WizardCard title="Portfolio" split={false} subtitle={<span className="font-medium">Quote #: {summary.quoteNumber}</span>}>
      <table className="w-full border-collapse text-[14px]"><thead><tr className="text-[12px] uppercase tracking-[.3px] text-[#5c6670]"><th className={cell}>Product</th><th className={cell}>Vehicles</th><th className={cell}>Policy Term</th><th className={cell}>Bill Plan</th><th className={cell}>Status</th><th className={`${cell} text-right`}>Premium</th></tr></thead><tbody>
        <tr><td className={cell}><span className="flex items-center gap-2 font-bold text-[#003865]"><Car size={20} strokeWidth={1.5} />AUTO</span></td><td className={cell}>{state.vehicles.map(vehicleName).join(', ')}</td><td className={cell}>{TERM_MONTHS} months<div className="text-[12px] text-[#5c6670]">{summary.effectiveDate} – {summary.expirationDate}</div></td><td className={cell}>{plan.name}</td><td className={cell}>{state.policy.policyNumber ? 'Sold' : 'Quoted'}</td><td className={`${cell} text-right font-bold`}>{rated ? formatCurrency(plan.total) : <button type="button" onClick={() => goToStep(4)} className="font-bold text-[#c2185b] underline">Recalculate</button>}</td></tr>
      </tbody></table>
      <div className="flex items-center justify-end gap-3 px-[16px] py-[12px] text-[14px]"><span className="text-[#5c6670]">Total Portfolio Premium:</span><span className="text-[18px] font-bold">{rated ? formatCurrency(plan.total) : '$ --.--'}</span></div>
    </WizardCard>
    <WizardCard title="Bundle Opportunities" split={false}>
      <div className="px-[21px] py-[16px] text-[14px] leading-[21px]">
        {additional.crossSell.length
          ? <><p>The customer has or will purchase these products. The <b>Multi Policy</b> discount is applied to the Auto quote:</p><ul className="mt-2 grid grid-cols-3 gap-2">{additional.crossSell.map((product) => <li key={product} className="flex items-center gap-2 rounded-[3px] border border-[#cfdbe3] px-3 py-2"><Building2 size={17} strokeWidth={1.5} className="text-[#003865]" />{product}</li>)}</ul></>
          : <p>No additional products were selected on Additional Details. Ask whether the customer rents or owns a motorcycle, boat, RV or business to earn the <b>Multi Policy</b> discount. <button type="button" onClick={() => goToStep(3)} className="font-bold text-[#0073cf] underline underline-offset-2">Update products</button></p>}
      </div>
    </WizardCard>
  </div>;
}

export function PortfolioStep() {
  return <WizardLayout><PortfolioContent /></WizardLayout>;
}
