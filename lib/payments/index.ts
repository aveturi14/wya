import { payid } from './payid';
import { PaymentProvider, ProviderId } from './types';

export type { PaymentProvider, ProviderId } from './types';

const PROVIDERS: Record<ProviderId, PaymentProvider> = { payid };

// Australia only for now, so PayID is the one provider. Screens ask for "the"
// provider rather than naming PayID, so adding regions doesn't touch them.
export const DEFAULT_PROVIDER: ProviderId = 'payid';

export function getProvider(id: ProviderId = DEFAULT_PROVIDER): PaymentProvider {
  return PROVIDERS[id];
}
