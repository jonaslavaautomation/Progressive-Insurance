import type { QuoteState } from '@/context/quoteStore';
import type { ProductKey } from '@/products/types';
import { activeProducts } from '@/utils/ratingEngine';

/** The product tab currently shown on Products and Coverages/Bill Plans. */
export function currentProduct(state: QuoteState): ProductKey {
  const products = activeProducts(state);
  return products.includes(state.ui.activeProduct) ? state.ui.activeProduct : products[0] ?? 'auto';
}
