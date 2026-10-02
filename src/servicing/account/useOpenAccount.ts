// Every way of pulling up a customer (search, a name or policy link, a notification) goes through
// the same loading screen to the Policy and Coverages account page (openAccount shows it).
import { useQuote } from '@/context/useQuote';

export function useOpenAccount(): (policyId: string, options?: { instant?: boolean }) => void {
  return useQuote().openAccount;
}
