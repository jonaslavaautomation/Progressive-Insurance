// Manage Policies > Policy Search.
import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import type { PolicyQuery } from '@/context/quoteStore';
import { useQuote } from '@/context/useQuote';
import { formatCurrency } from '@/utils/masks';
import { balance } from '@/services/policyEngine';
import { PRODUCT_FILTERS, STATUS_FILTERS, filterPolicies } from '@/servicing/policyFilters';
import { productTab } from '@/products/configs';
import { SelectControl, TextControl } from '@/components/wizard/primitives';
import { ServiceLayout, StatusBadge, TrainingClock, outlineButton, solidButton } from '@/servicing/ServiceChrome';

export function PolicySearch() {
  const { state, openPolicies, openPolicy, showDashboard } = useQuote();
  const [query, setQuery] = useState<PolicyQuery>(state.ui.policyQuery);
  const results = filterPolicies(state.policies, state.ui.policyQuery, state.simDate);
  const submit = (event: FormEvent) => { event.preventDefault(); openPolicies(query); };
  const cell = 'border-b border-[#edf1f3] px-[14px] py-[11px] text-left';
  const set = (patch: Partial<PolicyQuery>) => setQuery({ ...query, ...patch });
  return <ServiceLayout>
    <TrainingClock />
    <section className="mb-[20px] w-[1100px] rounded-[3px] border border-[#cfdbe3] bg-white">
      <h2 className="flex min-h-[45px] items-center border-b border-[#cfdbe3] bg-[#e4ecf1] px-[21px] font-slab text-[17px] font-bold">Policy Search</h2>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-[16px] px-[21px] py-[16px] text-[14px]">
        <fieldset className="flex flex-col gap-1"><legend className="sr-only">Search by</legend>{(['Customer', 'Policy'] as const).map((mode) => <label key={mode} className="flex items-center gap-2"><input type="radio" name="search-mode" checked={query.mode === mode} onChange={() => set({ mode })} className="h-[18px] w-[18px] accent-[#003865]" />{mode}</label>)}</fieldset>
        {query.mode === 'Customer' ? <>
          <label className="w-[190px]">Last Name<TextControl value={query.lastName} onChange={(lastName) => set({ lastName })} /></label>
          <label className="w-[190px]">First Name<TextControl value={query.firstName} onChange={(firstName) => set({ firstName })} /></label>
        </> : <label className="w-[220px]">Policy Number<TextControl value={query.policyNumber} mask="number" onChange={(policyNumber) => set({ policyNumber })} /></label>}
        <label className="w-[180px]">Product<SelectControl value={query.product} options={PRODUCT_FILTERS} onChange={(product) => set({ product })} /></label>
        <label className="w-[180px]">Policy Status<SelectControl value={query.status} options={STATUS_FILTERS} onChange={(status) => set({ status })} /></label>
        <button type="submit" className={solidButton}><Search size={15} />Search</button>
        <button type="button" onClick={() => { const empty = { ...query, lastName: '', firstName: '', policyNumber: '', product: 'All', status: 'All' }; setQuery(empty); openPolicies(empty); }} className={outlineButton}>Reset</button>
      </form>
    </section>
    <section className="w-[1100px] rounded-[3px] border border-[#cfdbe3] bg-white">
      <h2 className="flex min-h-[45px] items-center justify-between border-b border-[#cfdbe3] bg-[#e4ecf1] px-[21px] font-slab text-[17px] font-bold">Results<span className="font-roboto text-[13px] font-medium">{results.length} of {state.policies.length} polic{state.policies.length === 1 ? 'y' : 'ies'}</span></h2>
      {results.length ? <table className="w-full border-collapse text-[14px]"><thead><tr className="text-[12px] uppercase tracking-[.3px] text-[#5c6670]"><th className={cell}>Policy #</th><th className={cell}>Named Insured</th><th className={cell}>Product</th><th className={cell}>Status</th><th className={cell}>Policy Period</th><th className={`${cell} text-right`}>Term Premium</th><th className={`${cell} text-right`}>Balance</th></tr></thead><tbody>
        {results.map((policy) => <tr key={policy.id} className="hover:bg-[#f6f9fb]"><td className={cell}><button type="button" onClick={() => openPolicy(policy.id)} className="font-bold text-[#0073cf] underline underline-offset-2">{policy.policyNumber}</button></td><td className={cell}>{policy.insured.name}</td><td className={cell}>{productTab(policy.product)}</td><td className={cell}><StatusBadge status={policy.status} />{policy.renewal?.status === 'Offered' && <span className="ml-1 text-[11px] font-bold text-[#0073cf]">RENEWAL OFFERED</span>}</td><td className={cell}>{policy.effectiveDate} – {policy.expirationDate}</td><td className={`${cell} text-right tabular-nums`}>{formatCurrency(policy.termPremium)}</td><td className={`${cell} text-right tabular-nums`}>{formatCurrency(balance(policy))}</td></tr>)}
      </tbody></table> : <div className="px-[21px] py-[24px] text-[14px] text-[#5c6670]">{state.policies.length ? 'No policies match this search.' : <>No training policies yet. Complete a quote through <b>FINAL SALE</b> and click <b>Bind Policy</b> to issue one. <button type="button" onClick={showDashboard} className="font-bold text-[#0073cf] underline">Start a quote</button></>}</div>}
    </section>
  </ServiceLayout>;
}
