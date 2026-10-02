// Every way of pulling up a customer (search, a name or policy link, a notification) goes through
// the same loading screen to the Policy and Coverages account page.
import { useQuote } from '@/context/useQuote';
import { loadWithCar } from '@/services/carLoader';

export function useOpenAccount(): (policyId: string) => void {
  const { openAccount } = useQuote();
  return (policyId) => loadWithCar(() => openAccount(policyId));
}
