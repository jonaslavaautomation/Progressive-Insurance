import { useState } from 'react';
import { Home, Snowflake, Bike, Building2, BriefcaseBusiness, Bus, Car, Caravan, ExternalLink, Sailboat, Store, Truck, type LucideIcon } from 'lucide-react';
import type { CommercialKey, ProductKey } from '@/products/types';

type Product = { name: string; icon: LucideIcon; key?: ProductKey; commercial?: CommercialKey; partner?: string };
const productGroups: { title: string; products: Product[] }[] = [
  { title: 'Auto & Toys', products: [{ name: 'AUTO', icon: Car, key: 'auto' }, { name: 'MOTORCYCLE/ATV', icon: Bike, key: 'motorcycle' }, { name: 'BOAT/PWC', icon: Sailboat, key: 'boat' }, { name: 'MOTOR HOME', icon: Bus, key: 'motorhome' }, { name: 'TRAVEL TRAILER', icon: Caravan, key: 'trailer' }, { name: 'SNOWMOBILE', icon: Snowflake, key: 'snowmobile' }] },
  { title: 'Property', products: [{ name: 'RENTERS (HO4)', icon: Building2, key: 'renters' }, { name: 'MANUFACTURED HOME', icon: Home, partner: 'Manufactured Home' }] },
  { title: 'Business', products: [{ name: 'COMMERCIAL AUTO', icon: Truck, commercial: 'commercialAuto' }, { name: 'BUSINESSOWNER/ CONTRACTOR GL', icon: Store, commercial: 'bop' }, { name: 'EPLI, NPDO, CYBER AND MORE', icon: BriefcaseBusiness, commercial: 'mgmt' }] },
];

type Choice = { kind: 'personal'; key: ProductKey } | { kind: 'business'; key: CommercialKey } | null;

/**
 * Select Product. One product is chosen at a time: the chosen card turns navy, and picking another
 * card moves the selection. In "add" mode products already on the quote are shown locked. Business
 * products start a separate Commercial Lines quote. Rendered at fixed sizes (outside the dashboard
 * zoom) so it looks the same on every page.
 */
export function ProductModal({ onCancel, onContinue, onCommercial, existing = [], title }: { onCancel: () => void; onContinue: (products: ProductKey[]) => void; onCommercial?: (products: CommercialKey[]) => void; existing?: ProductKey[]; title?: string }) {
  const [choice, setChoice] = useState<Choice>(null);
  const [handoff, setHandoff] = useState('');
  const pick = ({ name, key, commercial, partner }: Product) => {
    if (key) { if (!existing.includes(key)) setChoice({ kind: 'personal', key }); return; }
    if (partner) { setHandoff(`partner:${partner}`); return; }
    if (commercial) { if (onCommercial) setChoice({ kind: 'business', key: commercial }); else setHandoff(name); }
  };
  const submit = () => {
    if (choice?.kind === 'business') onCommercial?.([choice.key]);
    else if (choice) onContinue([choice.key]);
  };
  return <div role="dialog" aria-modal aria-label={title ?? 'Select product'} className="fixed inset-0 z-50 overflow-y-auto bg-[#003865]/75 px-3 pb-6 pt-[86px]">
    <div className="mx-auto w-full max-w-[798px] rounded-[3px] border border-[#9ca6ab] bg-[#f6f5f0] px-[20px] pb-[16px] pt-[22px] shadow-2xl">
      {title && <h2 className="mb-[14px] text-[16px] font-bold text-[#003865]">{title}</h2>}
      <div role="radiogroup" aria-label="Product" className="grid grid-cols-1 gap-x-[36px] gap-y-[20px] sm:grid-cols-3">{productGroups.map((group) => <div key={group.title}>
        <h3 className="mb-[14px] border-b border-[#003865] pb-[2px] text-[14px] font-bold text-[#003865]">{group.title}</h3>
        <div className="space-y-[16px]">{group.products.map((product) => {
          const { name, icon: Icon, key, commercial: businessKey, partner } = product;
          const selected = !!choice && (choice.key === key || choice.key === businessKey);
          const locked = !!key && existing.includes(key);
          const external = !!partner || (!!businessKey && !onCommercial);
          const tone = selected ? 'border-dashed border-[#0b1f3a] bg-[#0b2c56] text-white shadow-[inset_0_0_0_2px_#0b2c56]' : locked ? 'cursor-default border-[#9ca6ab] bg-[#eef1f3] text-[#003865]' : `border-[#7b8a95] bg-white hover:border-[#0073cf] ${external && businessKey ? 'text-[#6f7d88]' : 'text-[#003865]'}`;
          return <button key={name} type="button" role={external ? undefined : 'radio'} aria-checked={external ? undefined : selected} aria-disabled={locked || undefined}
            title={locked ? 'Already on this quote' : partner ? 'Quoted through a partner carrier' : external ? 'Quoted separately in Commercial Lines' : businessKey ? 'Starts a Commercial Lines quote' : undefined}
            onClick={() => pick(product)}
            className={`relative flex h-[64px] w-full items-center gap-[16px] rounded-[3px] border-2 px-[14px] text-left text-[13.5px] font-bold leading-[16px] outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#0073cf] ${tone}`}>
            <Icon size={38} strokeWidth={1.2} className="shrink-0" />
            <span className={`flex-1 ${businessKey || partner ? 'text-center' : ''}`}>{name}{locked && <span className="mt-[2px] block text-[10.5px] font-medium">ON THIS QUOTE</span>}</span>
            {external && <ExternalLink size={13} strokeWidth={2} className="absolute bottom-[5px] right-[6px]" />}
          </button>;
        })}</div>
      </div>)}</div>
      {choice?.kind === 'business' && <p className="mt-[16px] text-center text-[13px] leading-[18px] text-[#2e3a43]">Business products are quoted in <b>Commercial Lines</b>, separately from personal lines.</p>}
      <div className="mt-[46px] flex justify-center gap-[8px]">
        <button type="button" onClick={onCancel} className="h-[36px] rounded-[2px] bg-[#0b2c56] px-[12px] text-[13.5px] font-bold text-white hover:bg-[#002746]">CANCEL</button>
        <button type="button" onClick={submit} disabled={!choice} className="h-[36px] rounded-[2px] bg-[#0073cf] px-[12px] text-[13.5px] font-bold text-white hover:bg-[#005da8] disabled:cursor-not-allowed disabled:bg-[#7fb3e3]">{choice?.kind === 'business' ? 'START COMMERCIAL QUOTE' : existing.length ? 'ADD PRODUCT TO QUOTE' : 'ADD PRODUCTS TO QUOTE'}</button>
      </div>
    </div>
    {handoff && <div role="dialog" aria-modal aria-label="Leaving LAVA Training" className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1b2a36]/55 pt-[140px]">
      <div className="w-[520px] rounded-[3px] bg-white p-[24px] text-[14px] text-[#2e3a43] shadow-2xl">
        {handoff.startsWith('partner:') ? <><h3 className="flex items-center gap-2 text-[17px] font-bold text-[#003865]"><ExternalLink size={17} />Quoted through a partner carrier</h3><p className="mt-[12px] leading-[21px]"><b>{handoff.slice(8)}</b> policies are written by a partner carrier and quoted in their system, which opens in a new window. Your quote here stays open; add the partner policy as a Multi Policy product on Additional Details once it is bound.</p><p className="mt-[10px] leading-[21px] text-[#5c6670]">Training simulation: the partner system is not part of this portal.</p></> : <><h3 className="flex items-center gap-2 text-[17px] font-bold text-[#003865]"><ExternalLink size={17} />Quoted separately in Commercial Lines</h3>
        <p className="mt-[12px] leading-[21px]"><b>{handoff}</b> can&rsquo;t be added to a personal lines quote. Return to the dashboard, choose <b>Select Product(s)</b> and pick the business product to start a Commercial Lines quote. This quote stays as it is.</p></>}
        <div className="mt-[18px] flex justify-end"><button type="button" autoFocus onClick={() => setHandoff('')} className="h-[36px] rounded-[2px] bg-[#0073cf] px-[14px] text-[13px] font-bold text-white hover:bg-[#005da8]">RETURN TO PRODUCTS</button></div>
      </div>
    </div>}
  </div>;
}
