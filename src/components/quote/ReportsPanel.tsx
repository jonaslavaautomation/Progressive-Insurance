import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ReportStatus } from '@/types/quote';
import { useQuote } from '@/context/useQuote';
import { fieldHints } from '@/data/trainingHints';
import { HintBubble, InlineError, WizardCard } from '@/components/wizard/primitives';
import { useFieldError } from '@/components/wizard/stepValidation';

const badge: Record<ReportStatus, { text: string; className: string }> = {
  pending: { text: 'Not ordered', className: 'bg-[#f2f2f2] text-[#52616c]' },
  ordered: { text: 'Ordering…', className: 'bg-[#e8f4fa] text-[#0073cf]' },
  cleared: { text: 'Cleared', className: 'bg-[#e6f4ef] text-[#05784c]' },
  flagged: { text: 'Flagged', className: 'bg-[#fdf0f1] text-[#c8102e]' },
};

function ReportRow({ label, status }: { label: string; status: ReportStatus }) {
  const { text, className } = badge[status];
  return <div className="flex min-h-[30px] items-center justify-between border-b border-[#edf1f3] px-[21px] text-[13px]"><span>{label}</span><span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold uppercase ${className}`}>{status === 'ordered' && <Loader2 size={10} className="animate-spin" />}{text}</span></div>;
}

export function ReportsPanel() {
  const { state, orderSimulatedReports } = useQuote();
  const { reports } = state;
  const error = useFieldError('reports');
  const busy = reports.mvrStatus === 'ordered';
  const done = reports.mvrStatus === 'cleared' || reports.mvrStatus === 'flagged';
  const cleared = reports.mvrStatus === 'cleared' && reports.clueStatus === 'cleared';
  const findings = [...reports.mvrFindings.map((finding) => `MVR: ${finding}`), ...reports.clueFindings.map((finding) => `CLUE: ${finding}`)];

  return <WizardCard title="MVR & CLUE Reports" split={false} subtitle={reports.verificationDate ? <span className="whitespace-nowrap text-[12px] font-medium">Verified {reports.verificationDate}</span> : <HintBubble text={fieldHints.reports} />}>
    {reports.staleReason && <div className="border-b border-[#f5a45d] bg-[#fff6ee] px-[21px] py-2 text-[13px] font-semibold text-[#9a4a0b]">{reports.staleReason}</div>}
    <ReportRow label="MVR (Motor Vehicle Report)" status={reports.mvrStatus} />
    <ReportRow label="CLUE (Loss History)" status={reports.clueStatus} />
    {done && cleared && <div className="m-3 flex items-center gap-2 rounded border border-[#07866f] bg-[#e6f4ef] px-[21px] py-2 text-[14px] font-bold text-[#05784c]"><CheckCircle2 size={16} /> Reports Cleared - No Major Violations Found</div>}
    {done && !cleared && <div className="m-3 rounded border border-[#c8102e] bg-[#fdf0f1] px-[21px] py-2 text-[13px] text-[#28343c]"><div className="mb-1 flex items-center gap-2 text-[14px] font-bold text-[#c8102e]"><AlertTriangle size={15} /> Reports Flagged - Review Findings</div><ul className="list-disc space-y-0.5 pl-5">{findings.map((finding) => <li key={finding}>{finding}</li>)}</ul></div>}
    <div className="px-[21px] pb-3 pt-2">
      <button id="reports" type="button" disabled={busy} onClick={() => void orderSimulatedReports()} className={`flex w-full items-center justify-center gap-2 h-[40px] rounded-[3px] px-[16px] text-[13px] font-bold shadow disabled:cursor-wait ${done ? 'border-2 border-[#0073cf] bg-white text-[#003865] hover:bg-[#e8f4fa]' : 'bg-[#0073cf] text-white hover:bg-[#005da8] disabled:bg-[#5a9fd8]'} ${error ? 'ring-2 ring-[#c8102e] ring-offset-1' : ''}`}>
        {busy ? <><Loader2 size={13} className="animate-spin" /> ORDERING REPORTS…</> : done ? 'RE-ORDER MVR & CLUE REPORTS' : 'ORDER MVR & CLUE REPORTS'}
      </button>
      <InlineError message={error} />
    </div>
  </WizardCard>;
}
