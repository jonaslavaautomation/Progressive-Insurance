import type { ReactNode } from 'react';
import { Car, Check } from 'lucide-react';
import { CROSS_SELL_PRODUCTS, type AdditionalDetails, type CrossSellProduct, type YesNo } from '@/types/quote';
import { PRIMARY_RESIDENCES, YES_NO } from '@/data/options';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { HelpDot, HintBubble, InlineError, MoneyTag, SelectControl } from '@/components/wizard/primitives';
import { useFieldError } from '@/components/wizard/stepValidation';
import { ProductQuestionsCard } from '@/components/products/ProductForms';
import { RentersDetailsCards, RentersOtherQuestions } from '@/steps/renters/RentersScreens';
import { productLabel } from '@/products/configs';
import type { OtherProductKey } from '@/products/types';
import { activeProducts, hasAuto } from '@/utils/ratingEngine';

/** Wide question row used on Additional Details: wrapped question, help/tag icon, 314px dropdown. */
function QuestionRow({ id, label, value, options, onChange, help, tag, hint }: { id: string; label: string; value: string; options: readonly string[]; onChange: (value: string) => void; help?: string; tag?: boolean; hint?: string }) {
  const error = useFieldError(id);
  return <div className="flex items-center text-[14px] leading-[21px] text-[#2e3a43]">
    <label htmlFor={id} className="flex w-[184px] shrink-0 items-start gap-1">{label}<HintBubble text={hint} /></label>
    <span className="ml-[8px] flex w-[18px] shrink-0 justify-center">{help && <HelpDot text={help} label={label.replace(/[:*?]/g, '').slice(0, 48)} />}{tag && <MoneyTag />}</span>
    <span className="ml-[6px] w-[314px]"><SelectControl id={id} value={value} options={options} onChange={onChange} error={error} /><InlineError message={error} /></span>
  </div>;
}

function Card({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-[3px] border border-[#cfdbe3] bg-white">
    <h2 className="flex min-h-[45px] items-center gap-[12px] rounded-t-[3px] border-b border-[#cfdbe3] bg-[#e4ecf1] px-[20px] font-slab text-[17px] font-bold text-[#2e3a43]">{icon}{title}<span className="ml-auto">{action}</span></h2>
    <div className="px-[20px] pb-[26px] pt-[26px]">{children}</div>
  </section>;
}

function ProductCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-[10px] text-[14px] leading-[16px] text-[#2e3a43]"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-[22px] w-[22px] shrink-0 rounded-[2px] accent-[#003865]" />{label}</label>;
}

function AdditionalDetailsContent() {
  const { state, updateAdditional } = useQuote();
  const { additional } = state;
  const setYesNo = (field: keyof AdditionalDetails) => (value: string) => updateAdditional({ [field]: value as YesNo } as Partial<AdditionalDetails>);
  const crossSellError = useFieldError('additional.crossSell');

  const toggleProduct = (product: CrossSellProduct, checked: boolean) => {
    const crossSell = checked ? [...additional.crossSell, product] : additional.crossSell.filter((entry) => entry !== product);
    updateAdditional({ crossSell, noAdditionalRisks: false });
  };
  // "No additional risks apply" is exclusive of every cross-sell product.
  const setNoRisks = (checked: boolean) => updateAdditional(checked ? { noAdditionalRisks: true, crossSell: [] } : { noAdditionalRisks: false });

  const products = activeProducts(state);
  const others = products.filter((key): key is OtherProductKey => key !== 'auto');
  const rentersOnly = !hasAuto(state) && others.every((key) => key === 'renters');
  return <div className="grid grid-cols-[560px_560px] items-start gap-[21px]">
      <div className="space-y-[21px]">{hasAuto(state) && <Card title="Auto Details" icon={<Car size={30} strokeWidth={1.3} className="text-[#2e3a43]" />} action={<HelpDot label="Auto Details" text="These underwriting questions determine eligibility and rating. Ask each question exactly as written." />}>
        <div className="space-y-[34px]">
          <QuestionRow id="additional.continuousInsurance" label="Insured/Spouse has vehicle liability insurance for past 6 months with no more than 31 days lapse:*" options={YES_NO} value={additional.continuousInsurance} onChange={setYesNo('continuousInsurance')} hint={fieldHints.continuousInsurance} />
          <QuestionRow id="additional.allDriversListed" label="Have you included all drivers required to be listed within the driver section of the quote?*" help={fieldHints.allDriversListed} options={YES_NO} value={additional.allDriversListed} onChange={setYesNo('allDriversListed')} />
          <QuestionRow id="additional.priorCancellation" label="Insured/Spouse had an auto policy canceled by an insurance company (except for non-payment of premium) within the past 5 years: *" help={fieldHints.priorCancellation} options={YES_NO} value={additional.priorCancellation} onChange={setYesNo('priorCancellation')} />
          <QuestionRow id="additional.jointOwnership" label="Are any vehicles owned by a corporation or a partnership; OR jointly owned by 2 or more individuals who do not reside in the same household? *" help={fieldHints.jointOwnership} options={YES_NO} value={additional.jointOwnership} onChange={setYesNo('jointOwnership')} />
        </div>
      </Card>}
      {others.map((key) => (key === 'renters' ? <RentersDetailsCards key={key} /> : <ProductQuestionsCard key={key} product={key} />))}
      </div>
      {rentersOnly ? <RentersOtherQuestions /> : <Card title="Other Questions">
        <div className="space-y-[24px]">
          <QuestionRow id="additional.paperless" label="Apply Paperless and accept documents and bills delivered through email? *" tag hint={fieldHints.paperless} options={YES_NO} value={additional.paperless} onChange={setYesNo('paperless')} />
          <QuestionRow id="additional.primaryResidence" label="Primary Residence:*" tag hint={fieldHints.primaryResidence} options={PRIMARY_RESIDENCES} value={additional.primaryResidence} onChange={(primaryResidence) => updateAdditional({ primaryResidence })} />
        </div>
        <h3 className="mt-[22px] flex items-center gap-[10px] text-[16px] font-bold text-[#5c6670]">Multi Policy Discount <MoneyTag /><HintBubble text={fieldHints.crossSell} /></h3>
        <p className="mt-[16px] max-w-[440px] text-[14px] leading-[21px]">The LAVA products checked below were found based on current policy information or may include products from a bundle, cross-sell or rewrite.</p>
        <div className="mt-[14px] flex h-[51px] items-center gap-[14px] rounded-[2px] border border-[#9aa6ae] px-[16px] text-[14px]"><Check size={18} className="text-[#5c7f9e]" strokeWidth={2} />{products.map(productLabel).join(', ')}</div>
        <p className="mt-[24px] text-[14px] leading-[21px]">Choose any additional LAVA products that the Insured or Spouse currently has or will purchase in the next month: *</p>
        <fieldset id="additional.crossSell" tabIndex={-1} aria-label="Additional LAVA products" className={`mt-[14px] grid grid-cols-3 gap-x-[20px] gap-y-[19px] rounded-[2px] border px-[10px] py-[16px] outline-none ${crossSellError ? 'border-[#c8102e] shadow-[inset_0_0_0_1px_#c8102e]' : 'border-[#9aa6ae]'}`}>
          {CROSS_SELL_PRODUCTS.map((product) => <ProductCheckbox key={product} label={product} checked={additional.crossSell.includes(product)} onChange={(checked) => toggleProduct(product, checked)} />)}
          <ProductCheckbox label="No additional risks apply" checked={additional.noAdditionalRisks} onChange={setNoRisks} />
        </fieldset>
        <InlineError message={crossSellError} />
      </Card>}
  </div>;
}

// Content renders inside the layout so field errors resolve against its validation context.
export function AdditionalDetailsStep() {
  return <WizardLayout><AdditionalDetailsContent /></WizardLayout>;
}

