// New Business pages: Begin a New Quote (with Quote Preferences), Existing Quote / Delete Quote and
// the Book Builder Program.
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQuote } from '@/context/useQuote';
import { SUPPORTED_STATES, rulesFor, stateOptions, type StateName } from '@/data/states';
import { BI_PD, COLL_DEDUCTIBLES, ETE, MED_PAY, OTC_DEDUCTIBLES, TOWING, UM_BI, US_STATES, coverageOptions } from '@/data/options';
import { PRODUCT_CONFIGS } from '@/products/configs';
import { RECOMMENDED_DEFAULTS, preferencesStore, savePreferences, type DefaultCoverages } from '@/services/quotePreferences';
import { notify } from '@/services/activity';
import { productLabel } from '@/products/configs';
import { activeProducts } from '@/utils/ratingEngine';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';
import { InlineError, SelectControl, TextControl } from '@/components/wizard/primitives';
import { PortalLayout } from '@/servicing/portal/PortalLayout';
import { Notice, PageTitle } from '@/servicing/portal/ServicePages';
import { blueButton, cell, headCell, smallButton } from '@/servicing/portal/pageStyles';
import { crossSellOpportunities, prospects } from '@/servicing/portal/bookStats';

type PrefDialog = '' | 'defaults' | 'print' | 'codes' | 'delete';

const field = (label: string, control: ReactNode) => <label className="block text-[13px]"><span className="mb-1 block font-medium">{label}</span>{control}</label>;
const rentersOptions = (key: string) => {
  const def = PRODUCT_CONFIGS.renters.coverages.find((entry) => entry.key === key);
  return Array.isArray(def?.options) ? def.options.map(({ value, label }) => ({ value, label })) : [];
};

function DefaultCoveragesModal({ onClose }: { onClose: (message?: string) => void }) {
  const prefs = preferencesStore.get();
  const [draft, setDraft] = useState<DefaultCoverages>(prefs.defaults ?? RECOMMENDED_DEFAULTS);
  const [error, setError] = useState('');
  const auto = (patch: Partial<DefaultCoverages['auto']>) => setDraft({ ...draft, auto: { ...draft.auto, ...patch } });
  const renters = (patch: Partial<DefaultCoverages['renters']>) => setDraft({ ...draft, renters: { ...draft.renters, ...patch } });
  const allLiability = [...new Set(SUPPORTED_STATES.flatMap((state) => rulesFor(state).liability))];
  const allUm = [...new Set(SUPPORTED_STATES.flatMap((state) => rulesFor(state).um.choices))].filter((value) => value !== 'Rejected');
  const save = () => {
    const amount = Number(draft.renters.personalProperty.replace(/\D/g, ''));
    if (amount < 5000 || amount > 150000) { setError('Default Personal Property must be between $5,000 and $150,000.'); return; }
    if (draft.auto.collDeductible !== 'None' && draft.auto.compDeductible === 'None') { setError('A Collision default requires an Other Than Collision default.'); return; }
    savePreferences({ defaults: { ...draft, renters: { ...draft.renters, personalProperty: String(amount) } } });
    notify({ kind: 'account', title: 'Default coverages updated', detail: `Auto BI ${draft.auto.bodilyInjuryPd}, UM ${draft.auto.uninsuredMotorist}; Renters $${amount.toLocaleString('en-US')} personal property, $${Number(draft.renters.liability).toLocaleString('en-US')} liability.`, target: { view: 'page', page: 'newQuote' } });
    onClose('Default coverages saved. They are applied to every new quote (state minimums still apply).');
  };
  return <Modal title="Default Coverages" width={820} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.primary} onClick={save}>Save Defaults</button></>}>
    <p className="mb-3 text-[13px] text-[#5c6670]">Coverages pre-selected on every new quote. You can still change them on each quote. A default that a state doesn&rsquo;t allow is replaced by that state&rsquo;s standard choice.</p>
    <h3 className="mb-2 text-[14px] font-bold text-[#003865]">Auto</h3>
    <div className="grid grid-cols-3 gap-3">
      {field('Bodily Injury & Property Damage', <SelectControl value={draft.auto.bodilyInjuryPd} options={coverageOptions(stateOptions(BI_PD, allLiability))} onChange={(bodilyInjuryPd) => auto({ bodilyInjuryPd })} />)}
      {field('UM/UIM Bodily Injury', <SelectControl value={draft.auto.uninsuredMotorist} options={coverageOptions(stateOptions(UM_BI, allUm))} onChange={(uninsuredMotorist) => auto({ uninsuredMotorist })} />)}
      {field('Medical Payments', <SelectControl value={draft.auto.medicalPayments} options={coverageOptions(MED_PAY)} onChange={(medicalPayments) => auto({ medicalPayments })} />)}
      {field('Other Than Collision', <SelectControl value={draft.auto.compDeductible} options={coverageOptions(OTC_DEDUCTIBLES)} onChange={(compDeductible) => auto({ compDeductible })} />)}
      {field('Collision', <SelectControl value={draft.auto.collDeductible} options={coverageOptions(COLL_DEDUCTIBLES)} onChange={(collDeductible) => auto({ collDeductible })} />)}
      {field('Rental (ETE)', <SelectControl value={draft.auto.rental} options={coverageOptions(ETE)} onChange={(rental) => auto({ rental })} />)}
      {field('Towing and Labor', <SelectControl value={draft.auto.roadside} options={coverageOptions(TOWING)} onChange={(roadside) => auto({ roadside })} />)}
    </div>
    <h3 className="mb-2 mt-5 text-[14px] font-bold text-[#003865]">Renters (HO4)</h3>
    <div className="grid grid-cols-3 gap-3">
      {field('Personal Property', <TextControl value={draft.renters.personalProperty} money mask="money" onChange={(personalProperty) => renters({ personalProperty })} />)}
      {field('Liability Limit', <SelectControl value={draft.renters.liability} options={rentersOptions('liability')} onChange={(liability) => renters({ liability })} />)}
      {field('Medical Payments Limit', <SelectControl value={draft.renters.medpay} options={rentersOptions('medpay')} onChange={(medpay) => renters({ medpay })} />)}
      {field('All Other Perils deductible', <SelectControl value={draft.renters.deductible} options={rentersOptions('deductible')} onChange={(deductible) => renters({ deductible })} />)}
      {field('HomeShield R Package', <SelectControl value={draft.renters.homeShield} options={rentersOptions('homeShield')} onChange={(homeShield) => renters({ homeShield })} />)}
    </div>
    <InlineError message={error} />
  </Modal>;
}

function PrintAddressesModal({ onClose }: { onClose: (message?: string) => void }) {
  const { state } = useQuote();
  const [draft, setDraft] = useState(() => { const saved = preferencesStore.get().printAddress; return saved.name ? saved : { ...saved, name: state.agent.agencyName, state: state.ui.quoteState }; });
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof draft>) => setDraft({ ...draft, ...patch });
  const save = () => {
    if (!draft.name.trim() || !draft.street.trim() || !draft.city.trim() || !/^\d{5}$/.test(draft.zip)) { setError('Enter the agency name, street, city and a 5-digit ZIP.'); return; }
    if (draft.phone && !/^\d{3}-\d{3}-\d{4}$/.test(draft.phone)) { setError('Enter the phone as XXX-XXX-XXXX.'); return; }
    savePreferences({ printAddress: draft });
    notify({ kind: 'account', title: 'Print address updated', detail: `${draft.name}, ${draft.street}, ${draft.city} ${draft.zip}.` });
    onClose('Print address saved.');
  };
  return <Modal title="Print Addresses" width={640} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.primary} onClick={save}>Save Address</button></>}>
    <p className="mb-3 text-[13px] text-[#5c6670]">The agency address printed on quote proposals and on the agent copy of policy documents.</p>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">{field('Agency name', <TextControl value={draft.name} onChange={(name) => set({ name })} />)}</div>
      <div className="col-span-2">{field('Street address', <TextControl value={draft.street} onChange={(street) => set({ street })} />)}</div>
      {field('City', <TextControl value={draft.city} onChange={(city) => set({ city })} />)}
      {field('State', <SelectControl value={draft.state} options={US_STATES} onChange={(value) => set({ state: value })} />)}
      {field('ZIP code', <TextControl value={draft.zip} mask="zip" onChange={(zip) => set({ zip })} />)}
      {field('Agency phone', <TextControl value={draft.phone} mask="phone" onChange={(phone) => set({ phone })} />)}
    </div>
    <label className="mt-3 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.useOnDocuments} onChange={(event) => set({ useOnDocuments: event.target.checked })} className="h-[16px] w-[16px] accent-[#003865]" />Print this address on quotes and policy documents</label>
    <InlineError message={error} />
  </Modal>;
}

function AgentCodesModal({ onClose }: { onClose: (message?: string) => void }) {
  const { state } = useQuote();
  const codes = [...new Set([state.agent.agencyCode, ...state.policies.map((policy) => policy.agentCode.split(' ')[0])])];
  const saved = preferencesStore.get().agentCodes;
  const [draft, setDraft] = useState(codes.map((code) => ({ code, description: saved.find((entry) => entry.code === code)?.description ?? '' })));
  const save = () => {
    savePreferences({ agentCodes: draft });
    notify({ kind: 'account', title: 'Agent code descriptions updated', detail: draft.map((entry) => `${entry.code}${entry.description ? ` (${entry.description})` : ''}`).join(', ') });
    onClose('Agent code descriptions saved.');
  };
  return <Modal title="Agent Code Descriptions" width={600} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.primary} onClick={save}>Save</button></>}>
    <p className="mb-3 text-[13px] text-[#5c6670]">Name each producer code so staff pick the right one when starting a quote (for example &ldquo;Main office&rdquo; or &ldquo;Branch 2&rdquo;).</p>
    <table className="w-full border-collapse text-[13px]"><thead><tr><th className={headCell}>Agent code</th><th className={headCell}>Description</th></tr></thead><tbody>{draft.map((entry, index) => <tr key={entry.code}><td className={`${cell} font-bold`}>{entry.code}</td><td className={cell}><TextControl value={entry.description} onChange={(description) => setDraft(draft.map((item, position) => (position === index ? { ...item, description } : item)))} /></td></tr>)}</tbody></table>
  </Modal>;
}

function DeletePreferencesModal({ onClose }: { onClose: (message?: string) => void }) {
  const [draft, setDraft] = useState(preferencesStore.get().deletePolicy);
  const save = () => {
    savePreferences({ deletePolicy: draft });
    notify({ kind: 'account', title: 'Quote delete preferences updated', detail: draft.days === 'Never' ? 'Unbound quotes are kept until deleted.' : `Unbound quotes are deleted after ${draft.days} days.` });
    onClose('Quote delete preferences saved.');
  };
  return <Modal title="Quote Delete Preferences" width={560} onClose={() => onClose()} footer={<><button type="button" className={modalButton.secondary} onClick={() => onClose()}>Cancel</button><button type="button" className={modalButton.primary} onClick={save}>Save</button></>}>
    <div className="space-y-3 text-[13px]">
      {field('Automatically delete unbound quotes after', <SelectControl value={draft.days} options={[{ value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }, { value: 'Never', label: 'Never (delete manually)' }]} onChange={(days) => setDraft({ ...draft, days })} />)}
      <label className="flex items-center gap-2"><input type="checkbox" checked={draft.confirm} onChange={(event) => setDraft({ ...draft, confirm: event.target.checked })} className="h-[16px] w-[16px] accent-[#003865]" />Ask me to confirm before deleting a quote</label>
      <p className="text-[#5c6670]">Bound quotes become policies and are never deleted.</p>
    </div>
  </Modal>;
}

export function NewQuotePage() {
  const { state, setQuoteState, openProductPicker } = useQuote();
  const prefs = useSyncExternalStore(preferencesStore.subscribe, preferencesStore.get);
  const [dialog, setDialog] = useState<PrefDialog>('');
  const [notice, setNotice] = useState('');
  const close = (message?: string) => { setDialog(''); if (message) setNotice(message); };
  const link = (label: string, target: PrefDialog, note?: string) => <li><button type="button" onClick={() => setDialog(target)} className="text-[15px] font-bold text-[#003865] underline underline-offset-2 hover:text-[#0073cf]">{label}</button>{note && <span className="ml-2 text-[11px] text-[#5c6670]">{note}</span>}</li>;
  return <PortalLayout>
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-[520px] flex-1">
        <h1 className="text-[26px] font-light">Begin a New Quote</h1>
        <Notice text={notice} onDismiss={() => setNotice('')} />
        <div className="mt-5 flex items-center gap-[60px] text-[13px]"><span className="w-[160px] font-bold">State</span><SelectControl id="new-quote-state" value={state.ui.quoteState} options={SUPPORTED_STATES} onChange={(value) => setQuoteState(value as StateName)} className="w-[510px]" /></div>
        <div className="mt-4 pl-[220px]"><button type="button" onClick={openProductPicker} className="h-[38px] rounded-[3px] bg-[#0073cf] px-[22px] text-[16px] font-bold text-white hover:bg-[#003865]">Select Product(s)</button></div>
      </div>
      <aside className="w-[470px] rounded-[3px] border border-[#8194a5]">
        <h2 className="border-b border-[#8194a5] bg-[#f3f6f9] px-3 py-2 text-[15px] font-medium text-[#003865]">Quote Preferences</h2>
        <div className="px-4 py-3"><p className="mb-3 text-[13px] font-bold">Review and update your agency quote preferences:</p>
          <ul className="space-y-[14px]">{link('Default Coverages', 'defaults', prefs.defaults ? 'Saved' : 'Not set')}{link('Print Addresses', 'print', prefs.printAddress.name ? 'Saved' : '')}{link('Agent Code Descriptions', 'codes')}{link('Quote Delete Preferences', 'delete', prefs.deletePolicy.days === 'Never' ? 'Never' : `${prefs.deletePolicy.days} days`)}</ul>
        </div>
      </aside>
    </div>
    {dialog === 'defaults' && <DefaultCoveragesModal onClose={close} />}
    {dialog === 'print' && <PrintAddressesModal onClose={close} />}
    {dialog === 'codes' && <AgentCodesModal onClose={close} />}
    {dialog === 'delete' && <DeletePreferencesModal onClose={close} />}
  </PortalLayout>;
}

export function ExistingQuotesPage() {
  const { state, goToStep, openCommercial, resetQuote, discardCommercial } = useQuote();
  const [notice, setNotice] = useState('');
  const confirmDelete = preferencesStore.get().deletePolicy.confirm;
  const personal = state.ui.maxStep > 0 || !!(state.insured.firstName || state.insured.lastName) ? state : null;
  const commercial = state.commercial && !state.commercial.boundPolicyIds.length ? state.commercial : null;
  const rows = [
    ...(personal && !personal.policy.policyNumber ? [{ key: 'personal', quote: personal.policy.quoteNumber || '(assigned when saved)', customer: [personal.insured.firstName, personal.insured.lastName].filter(Boolean).join(' ') || 'New customer', products: activeProducts(personal).map(productLabel).join(', '), state: personal.policy.quoteState, step: `Step ${personal.ui.maxStep + 1} of 8`, open: () => goToStep(personal.ui.step), remove: () => { resetQuote(); } }] : []),
    ...(commercial ? [{ key: 'commercial', quote: commercial.productQuotes[commercial.products[0]]?.quoteNumber ?? '', customer: commercial.business.name || 'New business', products: commercial.products.map(productLabel).join(', '), state: commercial.business.state || state.ui.quoteState, step: `Step ${commercial.maxStep + 1} of 6`, open: openCommercial, remove: discardCommercial }] : []),
  ];
  return <PortalLayout crumbs={[{ label: 'New Business' }, { label: 'Existing Quote' }]}>
    <PageTitle title="Existing & Delete Quote" intro="Open an unbound quote to continue it, or delete quotes you no longer need. Bound quotes become policies in Manage Policies." />
    <Notice text={notice} onDismiss={() => setNotice('')} />
    <table className="mt-4 w-full border-collapse text-[12.5px]"><thead><tr>{['Quote #', 'Customer', 'Products', 'State', 'Progress', ''].map((label) => <th key={label} className={headCell}>{label}</th>)}</tr></thead><tbody>
      {rows.map((row) => <tr key={row.key}><td className={`${cell} font-bold`}>{row.quote}</td><td className={cell}>{row.customer}</td><td className={cell}>{row.products}</td><td className={cell}>{row.state}</td><td className={cell}>{row.step}</td><td className={cell}><div className="flex gap-2"><button type="button" onClick={row.open} className={smallButton}>Open Quote</button><button type="button" onClick={() => { if (confirmDelete && !window.confirm(`Delete quote ${row.quote} for ${row.customer}? This cannot be undone.`)) return; notify({ kind: 'quote', title: 'Quote deleted', detail: `Quote ${row.quote} for ${row.customer} (${row.products}).` }); row.remove(); setNotice(`Quote ${row.quote} deleted.`); }} className={`${smallButton} bg-[#c8102e] hover:bg-[#9e0c24]`}>Delete Quote</button></div></td></tr>)}
      {!rows.length && <tr><td colSpan={6} className={`${cell} text-center text-[#5c6670]`}>No unbound quotes. Start one from New Business › New Quote/Quote Preferences.</td></tr>}
    </tbody></table>
  </PortalLayout>;
}

export function BookBuilderPage() {
  const { state, openPage } = useQuote();
  const cross = crossSellOpportunities(state.policies).length;
  const winBack = prospects(state.policies).length;
  return <PortalLayout crumbs={[{ label: 'New Business' }, { label: 'Book Builder Program' }]}>
    <PageTitle title="Book Builder Program" intro="Grow your book with leads from your own customers: bundle opportunities, win-backs and requotes. Book Builder agencies earn bonus points toward their Paths to Partnership tier for every bundled policy." />
    <div className="mt-5 grid max-w-[980px] grid-cols-3 gap-4">{([['Bundle opportunities', String(cross), 'Customers missing a product that pairs with what they have.', 'crossSell'], ['Win-back prospects', String(winBack), 'Cancelled, expired or non-renewed customers to requote.', 'prospects'], ['Policies in force', String(state.policies.filter((policy) => policy.status === 'Active' || policy.status === 'Pending Cancel').length), 'Your current book of business.', 'production']] as [string, string, string, string][]).map(([title, value, text, page]) => <section key={title} className="rounded-[3px] border border-[#cfdbe3] p-4"><div className="text-[11px] font-bold uppercase text-[#5c6670]">{title}</div><div className="mt-1 text-[28px] font-bold text-[#003865]">{value}</div><p className="mt-1 text-[12.5px]">{text}</p><button type="button" onClick={() => openPage(page as never)} className={`mt-3 ${blueButton}`}>View</button></section>)}</div>
    <h2 className="mt-8 text-[16px] font-bold text-[#003865]">How it works</h2>
    <ol className="mt-2 max-w-[980px] list-decimal space-y-1 pl-5 text-[13px]"><li>Work the bundle list: quote Renters for auto-only customers and Auto for renters-only customers.</li><li>Call win-back prospects 30 days before their prior policy&rsquo;s anniversary.</li><li>Every bound bundle adds the Multi Policy discount and counts toward your tier.</li></ol>
  </PortalLayout>;
}
