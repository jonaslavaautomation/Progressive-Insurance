// Rating worksheet: how each premium on the quote was calculated, step by step (base rate, then
// every rating factor and discount), so an agent can explain exactly why a quote costs what it does.
import type { CoverageWorksheet, RatingResult, WorksheetLine } from '@/types/quote';
import { formatCurrency } from '@/utils/masks';

function Lines({ lines }: { lines: WorksheetLine[] }) {
  return <table className="w-full border-collapse text-[12.5px]"><tbody>{lines.map((line, index) => <tr key={`${line.label}-${index}`} className="border-b border-[#edf1f3] last:border-b-0"><td className="py-[4px] pr-3 text-[#2e3a43]">{line.label}</td><td className="w-[90px] py-[4px] text-right tabular-nums text-[#003865]">{line.value}</td></tr>)}</tbody></table>;
}

function Coverage({ sheet, open }: { sheet: CoverageWorksheet; open?: boolean }) {
  return <details open={open} className="group border-b border-[#e4ecf1] last:border-b-0">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-[12px] py-[8px] text-[13px] hover:bg-[#f6f9fb]">
      <span><span className="inline-block w-[14px] text-[#0073cf] group-open:rotate-90">›</span><b>{sheet.coverage}</b> <span className="text-[#5c6670]">{sheet.limit}</span></span>
      <span className="font-bold tabular-nums">{formatCurrency(sheet.premium)}</span>
    </summary>
    <div className="bg-[#f6f9fb] px-[26px] pb-[8px] pt-[4px]"><Lines lines={sheet.lines} /><div className="mt-[4px] flex justify-between border-t border-[#cfdbe3] pt-[4px] text-[12.5px] font-bold"><span>Premium (6 months)</span><span className="tabular-nums">{formatCurrency(sheet.premium)}</span></div></div>
  </details>;
}

export function RatingWorksheet({ rating }: { rating: RatingResult }) {
  const { worksheet, fees } = rating;
  return <div className="space-y-[14px]">
    <p className="text-[12.5px] leading-[18px] text-[#5c6670]">Each premium starts from the coverage base rate and is multiplied by the rating factors below. Factors come only from the applicant&rsquo;s information: drivers, driving record, vehicles, garaging ZIP, coverages, prior insurance, Point of Sale reports and discounts. The same information always produces the same premium. LAVA training rates, not any carrier&rsquo;s filed rates.</p>
    {worksheet.drivers.length > 0 && <section className="rounded-[3px] border border-[#cfdbe3]">
      <h3 className="border-b border-[#cfdbe3] bg-[#e4ecf1] px-[12px] py-[6px] text-[13px] font-bold">Driver factors</h3>
      {worksheet.drivers.map((driver) => <details key={driver.name} className="group border-b border-[#e4ecf1] last:border-b-0">
        <summary className="flex cursor-pointer list-none items-center justify-between px-[12px] py-[8px] text-[13px] hover:bg-[#f6f9fb]"><span><span className="inline-block w-[14px] text-[#0073cf] group-open:rotate-90">›</span><b>{driver.name}</b></span><span className="font-bold tabular-nums">×{driver.factor}</span></summary>
        <div className="bg-[#f6f9fb] px-[26px] pb-[8px] pt-[4px]"><Lines lines={driver.lines} /></div>
      </details>)}
    </section>}
    {worksheet.vehicles.map((vehicle, index) => <section key={vehicle.label} className="rounded-[3px] border border-[#cfdbe3]">
      <h3 className="flex justify-between border-b border-[#cfdbe3] bg-[#e4ecf1] px-[12px] py-[6px] text-[13px] font-bold"><span>{vehicle.label} · principal driver {vehicle.principal}</span><span className="tabular-nums">{formatCurrency(vehicle.total)}</span></h3>
      {vehicle.coverages.map((sheet, sheetIndex) => <Coverage key={sheet.coverage} sheet={sheet} open={index === 0 && sheetIndex === 0} />)}
    </section>)}
    <section className="rounded-[3px] border border-[#cfdbe3]">
      <h3 className="border-b border-[#cfdbe3] bg-[#e4ecf1] px-[12px] py-[6px] text-[13px] font-bold">Policy coverages and fees</h3>
      {worksheet.policy.filter((sheet) => sheet.premium > 0).map((sheet) => <Coverage key={sheet.coverage} sheet={sheet} />)}
      {fees.map((fee) => <div key={fee.label} className="flex justify-between border-b border-[#e4ecf1] px-[26px] py-[8px] text-[13px] last:border-b-0"><span>{fee.label}</span><b className="tabular-nums">{formatCurrency(fee.amount)}</b></div>)}
      <div className="flex justify-between px-[12px] py-[8px] text-[14px] font-bold"><span>Total 6-month premium (before Pay in Full discount and installment fees)</span><span className="tabular-nums">{formatCurrency(rating.fullTermPremium)}</span></div>
    </section>
  </div>;
}
