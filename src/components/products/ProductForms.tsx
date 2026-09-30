// Personal-lines wrappers around the generic product editors (Products, Additional Details,
// Coverages/Bill Plans for Motorcycle/ATV, Boat/PWC, Motor Home, Travel Trailer and Renters).
import type { ReactNode } from 'react';
import type { FieldDef, OtherProductKey } from '@/products/types';
import { PRODUCT_ICONS } from '@/products/icons';
import { PRODUCT_CONFIGS } from '@/products/configs';
import { fieldContext, isProductRated, rateProduct } from '@/products/engine';
import { useQuote } from '@/context/useQuote';
import { ConfigField, CoveragesEditor, InterestedPartiesCard, QuestionsCard, UnitsEditor } from '@/components/products/Editors';

/** A single config field bound to the personal quote's field context. */
export function ProductField({ field, id, value, values, onChange }: { field: FieldDef; id: string; value: string; values: Record<string, string>; onChange: (value: string) => void }) {
  const { state } = useQuote();
  return <ConfigField field={field} id={id} value={value} ctx={fieldContext(state, values)} onChange={onChange} />;
}

export function ProductUnitsContent({ product }: { product: OtherProductKey }) {
  const { state, addUnit, removeUnit, updateUnitValues, updateProduct } = useQuote();
  const quote = state.productQuotes[product];
  if (!quote) return null;
  const side = product === 'renters' ? <InterestedPartiesCard interests={quote.interests} onChange={(interests) => updateProduct(product, { interests })} description="Add the landlord or property manager if the lease requires proof of renters insurance. They receive a copy of the declarations and notice of cancellation." /> : undefined;
  return <div className="mt-[20px]"><UnitsEditor config={PRODUCT_CONFIGS[product]} quote={quote} ctxFor={(values) => fieldContext(state, values)} idPrefix={`unit.${product}`} icon={PRODUCT_ICONS[product]} onValues={(unitId, values) => updateUnitValues(product, unitId, values)} onAdd={() => addUnit(product)} onRemove={(unitId) => removeUnit(product, unitId)} side={side} /></div>;
}

export function ProductQuestionsCard({ product }: { product: OtherProductKey }) {
  const { state, updateProduct } = useQuote();
  const config = PRODUCT_CONFIGS[product];
  const answers = state.productQuotes[product]?.answers ?? {};
  return <QuestionsCard title={`${config.name} Details`} icon={PRODUCT_ICONS[product]} questions={config.questions} answers={answers} ctx={fieldContext(state, answers)} idPrefix={`answer.${product}`} onAnswer={(key, value) => updateProduct(product, { answers: { ...answers, [key]: value } })} />;
}

export function ProductCoveragesContent({ product, billPlans }: { product: OtherProductKey; billPlans: ReactNode }) {
  const { state, updateUnitCoverages, updateProduct } = useQuote();
  const quote = state.productQuotes[product];
  if (!quote) return null;
  const config = PRODUCT_CONFIGS[product];
  return <CoveragesEditor config={config} quote={quote} rating={rateProduct(product, state)} rated={isProductRated(product, state)} ctxFor={(values) => fieldContext(state, values)} idPrefix={`coverage.${product}`}
    onUnitCoverage={(unitId, key, value) => updateUnitCoverages(product, unitId, { [key]: value })}
    onPolicyCoverage={(key, value) => updateProduct(product, { coverages: { ...quote.coverages, [key]: value } })}
    billPlans={billPlans} policyTitle={product === 'renters' ? 'Coverages' : undefined} singleSubtitle={product === 'renters' ? config.describe(quote.units[0]) : undefined} />;
}
