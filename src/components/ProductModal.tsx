import { useState } from 'react';
import { Bike, Building2, BriefcaseBusiness, Bus, Car, Caravan, ExternalLink, Sailboat, Store, Truck, type LucideIcon } from 'lucide-react';
import type { CommercialKey, ProductKey } from '@/products/types';

type Product = { name: string; icon: LucideIcon; key?: ProductKey; commercial?: CommercialKey };
const productGroups: { title: string; products: Product[] }[] = [
  { title: 'Auto & Toys', products: [{ name: 'AUTO', icon: Car, key: 'auto' }, { name: 'MOTORCYCLE/ATV', icon: Bike, key: 'motorcycle' }, { name: 'BOAT/PWC', icon: Sailboat, key: 'boat' }, { name: 'MOTOR HOME', icon: Bus, key: 'motorhome' }, { name: 'TRAVEL TRAILER', icon: Caravan, key: 'trailer' }] },
  { title: 'Property', products: [{ name: 'RENTERS (HO4)', icon: Building2, key: 'renters' }] },
  { title: 'Business', products: [{ name: 'COMMERCIAL AUTO', icon: Truck, commercial: 'commercialAuto' }, { name: 'BUSINESSOWNER/ CONTRACTOR GL', icon: Store, commercial: 'bop' }, { name: 'EPLI, NPDO, CYBER AND MORE', icon: BriefcaseBusiness, commercial: 'mgmt' }] },
];

/**
 * Select Product(s). In "add" mode products already on the quote are locked in. Business products
 * start a separate Commercial Lines quote, so they can't be mixed with personal lines.
 */
export function ProductModal({ onCancel, onContinue, onCommercial, existing = [], title }: { onCancel: () => void; onContinue: (products: ProductKey[]) => void; onCommercial?: (products: CommercialKey[]) => void; existing?: ProductKey[]; title?: string }) {
  const [selected, setSelected] = useState<ProductKey[]>(existing.length ? existing : ['auto']);
  const [business, setBusiness] = useState<CommercialKey[]>([]);
  const [handoff, setHandoff] = useState('');
  const toggle = (key: ProductKey) => {
    if (existing.includes(key)) return;
    setBusiness([]);
    setSelected((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  };
  const toggleBusiness = (key: CommercialKey, name: string) => {
    if (!onCommercial) { setHandoff(name); return; }
    setSelected([]);
    setBusiness((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  };
  const added = selected.filter((key) => !existing.includes(key));
  const commercial = business.length > 0;
  const canContinue = commercial || (existing.length ? added.length > 0 : selected.length > 0);
  return <div role="dialog" aria-modal aria-label={title ?? 'Select product(s)'} className="fixed inset-0 z-50 overflow-y-auto bg-[#003865]/75 px-3 pb-6 pt-[98px]">
    <div className="mx-auto max-w-[540px] rounded-[3px] border border-[#9ca6ab] bg-[#f6f5f0] px-[14px] pb-[14px] pt-[16px] shadow-2xl">
      {title && <h2 className="mb-[10px] text-[12px] font-bold text-[#003865]">{title}</h2>}
      <div className="grid grid-cols-3 gap-[22px]">{productGroups.map((group) => <div key={group.title}><h2 className="mb-[8px] border-b-2 border-[#9ca6ab] pb-[3px] text-[10px] font-bold text-[#003865]">{group.title}</h2><div className="space-y-[10px]">{group.products.map(({ name, icon: Icon, key, commercial: businessKey }) => {
        const isSelected = key ? selected.includes(key) : !!businessKey && business.includes(businessKey);
        const external = !!businessKey && !onCommercial;
        const locked = !!key && existing.includes(key);
        return <button key={name} type="button" aria-pressed={external ? undefined : isSelected} title={locked ? 'Already on this quote' : external ? 'Quoted separately in Commercial Lines' : businessKey ? 'Starts a Commercial Lines quote' : undefined} onClick={() => (key ? toggle(key) : businessKey && toggleBusiness(businessKey, name))} className={`relative flex min-h-[43px] w-full items-center gap-[12px] rounded-[3px] border-[1.5px] bg-white px-[10px] text-left text-[9.5px] font-bold leading-[12px] text-[#003865] outline-none focus-visible:shadow-[0_0_0_1.5px_#0073cf] ${isSelected ? 'border-[#f26722] shadow-[0_0_0_1.5px_#0073cf]' : 'border-[#9ca6ab] hover:border-[#f26722]'} ${locked ? 'cursor-default opacity-80' : ''}`}><Icon size={27} strokeWidth={1.3} className="shrink-0" /><span className="pr-2">{name}</span>{external && <ExternalLink size={10} strokeWidth={2} className="absolute bottom-[4px] right-[4px]" />}{isSelected && <span className="absolute right-[5px] top-[4px] h-[7px] w-[7px] rounded-full bg-[#f26722]" aria-hidden />}</button>;
      })}</div></div>)}</div>
      {commercial && <p className="mt-[14px] text-center text-[10.5px] leading-[14px] text-[#2e3a43]">Business products are quoted in <b>Commercial Lines</b>, separately from personal lines. Select any combination of business products.</p>}
      <div className="mt-[22px] flex justify-center gap-[6px]"><button type="button" onClick={onCancel} className="rounded-[2px] bg-[#003865] px-[10px] py-[6px] text-[9.5px] font-bold text-white hover:bg-[#002746]">CANCEL</button><button type="button" onClick={() => (commercial ? onCommercial?.(business) : onContinue(existing.length ? added : selected))} disabled={!canContinue} className="rounded-[2px] bg-[#0073cf] px-[10px] py-[6px] text-[9.5px] font-bold text-white hover:bg-[#005da8] disabled:cursor-not-allowed disabled:bg-[#7fb3e3]">{commercial ? 'START COMMERCIAL QUOTE' : 'ADD PRODUCTS TO QUOTE'}</button></div>
    </div>
    {handoff && <div role="dialog" aria-modal aria-label="Leaving ForAgentsOnly" className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1b2a36]/55 pt-[140px]">
      <div className="w-[420px] rounded-[3px] bg-white p-[20px] text-[12px] text-[#2e3a43] shadow-2xl">
        <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#003865]"><ExternalLink size={15} />Quoted separately in Commercial Lines</h3>
        <p className="mt-[10px] leading-[18px]"><b>{handoff}</b> can&rsquo;t be added to a personal lines quote. Return to the dashboard, choose <b>Select Product(s)</b> and pick the business products to start a Commercial Lines quote. This quote stays as it is.</p>
        <div className="mt-[16px] flex justify-end"><button type="button" autoFocus onClick={() => setHandoff('')} className="rounded-[2px] bg-[#0073cf] px-[12px] py-[7px] text-[10px] font-bold text-white hover:bg-[#005da8]">RETURN TO PRODUCTS</button></div>
      </div>
    </div>}
  </div>;
}
