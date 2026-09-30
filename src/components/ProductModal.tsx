import { useState } from 'react';
import { Bike, Building2, BriefcaseBusiness, Bus, Car, Caravan, ExternalLink, Sailboat, Store, Truck, type LucideIcon } from 'lucide-react';

type Product = { name: string; icon: LucideIcon; external?: boolean };
const productGroups: { title: string; products: Product[] }[] = [
  { title: 'Auto & Toys', products: [{ name: 'AUTO', icon: Car }, { name: 'MOTORCYCLE/ATV', icon: Bike }, { name: 'BOAT/PWC', icon: Sailboat }, { name: 'MOTOR HOME', icon: Bus }, { name: 'TRAVEL TRAILER', icon: Caravan }] },
  { title: 'Property', products: [{ name: 'RENTERS (HO4)', icon: Building2 }] },
  { title: 'Business', products: [{ name: 'COMMERCIAL AUTO', icon: Truck, external: true }, { name: 'BUSINESSOWNER/ CONTRACTOR GL', icon: Store, external: true }, { name: 'EPLI, NPDO, CYBER AND MORE', icon: BriefcaseBusiness, external: true }] },
];
// Only Auto is wired into the training quote flow.
const AVAILABLE = 'AUTO';

export function ProductModal({ onCancel, onContinue }: { onCancel: () => void; onContinue: () => void }) {
  const [selected, setSelected] = useState(AVAILABLE);
  return <div role="dialog" aria-modal aria-label="Select product(s)" className="fixed inset-0 z-50 overflow-y-auto bg-[#003865]/75 px-3 pb-6 pt-[98px]">
    <div className="mx-auto max-w-[540px] rounded-[3px] border border-[#9ca6ab] bg-[#f6f5f0] px-[14px] pb-[14px] pt-[16px] shadow-2xl">
      <div className="grid grid-cols-3 gap-[22px]">{productGroups.map((group) => <div key={group.title}><h2 className="mb-[8px] border-b-2 border-[#9ca6ab] pb-[3px] text-[10px] font-bold text-[#003865]">{group.title}</h2><div className="space-y-[10px]">{group.products.map(({ name, icon: Icon, external }) => {
        const available = name === AVAILABLE;
        return <button key={name} type="button" title={available ? undefined : 'Not available in the training simulation'} onClick={() => available && setSelected(name)} className={`relative flex min-h-[43px] w-full items-center gap-[12px] rounded-[3px] border-[1.5px] bg-white px-[10px] text-left text-[9.5px] font-bold leading-[12px] text-[#003865] ${selected === name ? 'border-[#f26722] shadow-[0_0_0_1.5px_#0073cf]' : 'border-[#9ca6ab]'} ${available ? 'hover:border-[#f26722]' : 'cursor-default'}`}><Icon size={27} strokeWidth={1.3} className="shrink-0" /><span className="pr-2">{name}</span>{external && <ExternalLink size={10} strokeWidth={2} className="absolute bottom-[4px] right-[4px]" />}</button>;
      })}</div></div>)}</div>
      <div className="mt-[22px] flex justify-center gap-[6px]"><button type="button" onClick={onCancel} className="rounded-[2px] bg-[#003865] px-[10px] py-[6px] text-[9.5px] font-bold text-white hover:bg-[#002746]">CANCEL</button><button type="button" onClick={onContinue} disabled={!selected} className="rounded-[2px] bg-[#0073cf] px-[10px] py-[6px] text-[9.5px] font-bold text-white hover:bg-[#005da8]">ADD PRODUCTS TO QUOTE</button></div>
    </div>
  </div>;
}
