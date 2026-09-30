import { useQuote } from '@/context/useQuote';
import { formatCurrency } from '@/utils/masks';
import { SAFE_DRIVER_RATE } from '@/utils/ratingEngine';
import { WizardCard } from '@/components/wizard/primitives';

const safeDriverCopy = {
  applied: { text: `Safe Driver ${SAFE_DRIVER_RATE * 100}% discount applied`, className: 'bg-[#e6f4ef] text-[#05784c]' },
  pending: { text: `Safe Driver ${SAFE_DRIVER_RATE * 100}% eligible: applies once MVR & CLUE clear`, className: 'bg-[#fff6ee] text-[#9a4a0b]' },
  ineligible: { text: 'Not eligible for Safe Driver (incidents on record)', className: 'bg-[#f2f2f2] text-[#52616c]' },
};

export function RatePanel({ breakdownOpen = false }: { breakdownOpen?: boolean }) {
  const { rating } = useQuote();
  const safe = safeDriverCopy[rating.safeDriver];
  return <WizardCard title="Estimated Premium" split={false}>
    <div className="px-4 py-3 text-center">
      <div className="text-[13px] font-bold uppercase tracking-wide text-[#52616c]">Monthly</div>
      <div className="text-[32px] font-bold leading-tight text-[#003865]" aria-live="polite">{formatCurrency(rating.monthlyPremium)}</div>
      <div className="text-[13px] text-[#52616c]">12-month total {formatCurrency(rating.annualPremium)}</div>
      <div className="mt-1 text-[13px] font-semibold text-[#003865]">Paid in full: {formatCurrency(rating.paidInFullPremium)} <span className="text-[#05784c]">(save {formatCurrency(rating.paidInFullSavings)})</span></div>
    </div>
    <div className={`mx-3 mb-3 rounded px-2 py-1 text-center text-[13px] font-semibold ${safe.className}`}>{safe.text}</div>
    <details open={breakdownOpen} className="border-t border-[#edf1f3] text-[13px]">
      <summary className="cursor-pointer px-[21px] py-2 font-bold text-[#003865]">Rating breakdown</summary>
      <table className="w-full"><tbody>
        {rating.lines.map((line, index) => <tr key={index} className="border-t border-[#edf1f3]"><td className="px-[21px] py-1">{line.label}</td><td className={`px-3 py-1 text-right tabular-nums ${line.amount < 0 ? 'text-[#05784c]' : ''}`}>{line.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(line.amount))}</td></tr>)}
        <tr className="border-t-2 border-[#c6d6e1] font-bold"><td className="px-[21px] py-1">Subtotal</td><td className="px-[21px] py-1 text-right tabular-nums">{formatCurrency(rating.subtotal)}</td></tr>
        {rating.discounts.map((line) => <tr key={line.label} className="border-t border-[#edf1f3] text-[#05784c]"><td className="px-[21px] py-1">{line.label}</td><td className="px-[21px] py-1 text-right tabular-nums">−{formatCurrency(Math.abs(line.amount))}</td></tr>)}
        <tr className="border-t-2 border-[#c6d6e1] font-bold text-[#003865]"><td className="px-[21px] py-1">Monthly premium</td><td className="px-[21px] py-1 text-right tabular-nums">{formatCurrency(rating.monthlyPremium)}</td></tr>
      </tbody></table>
    </details>
  </WizardCard>;
}
