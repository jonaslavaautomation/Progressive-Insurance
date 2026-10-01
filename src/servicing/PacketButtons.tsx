// Download buttons for a policy's PDF documents: Declarations Page and each policy packet copy.
import { Download } from 'lucide-react';
import type { PolicyRecord } from '@/types/policy';
import { downloadDeclarationsPdf, downloadPolicyPacket, packetCopies } from '@/services/pdf/policyPdf';

export function PacketButtons({ policy, compact = false }: { policy: PolicyRecord; compact?: boolean }) {
  const button = compact
    ? 'inline-flex h-[28px] items-center gap-1 rounded-[3px] border border-[#0073cf] bg-white px-[10px] text-[11.5px] font-bold text-[#003865] hover:bg-[#e8f4fa]'
    : 'inline-flex h-[34px] items-center gap-2 rounded-[3px] border-2 border-[#0073cf] bg-white px-[12px] text-[12.5px] font-bold uppercase text-[#003865] hover:bg-[#e8f4fa]';
  const heading = policy.termNumber > 1 ? 'Renewal Declarations Page' : 'Declarations Page';
  return <span className="inline-flex flex-wrap gap-[8px]">
    <button type="button" onClick={() => downloadDeclarationsPdf(policy, heading)} className={button}><Download size={compact ? 13 : 15} />Declarations (PDF)</button>
    {packetCopies(policy).map((copy) => <button key={copy} type="button" onClick={() => downloadPolicyPacket(policy, copy)} className={button}><Download size={compact ? 13 : 15} />{copy} (PDF)</button>)}
  </span>;
}
