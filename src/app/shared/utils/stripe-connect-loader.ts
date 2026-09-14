export type StripeConnectComponent =
  | 'payments'
  | 'payment-details'
  | 'payouts'
  | 'payouts-list'
  | 'disputes-list'
  | 'balances'
  | 'documents'
  | 'account-onboarding';

export interface StripeConnectElement extends HTMLElement {
  setOnExit?(handler: () => void): void;
  setPayment?(paymentId: string): void;
  setOnClose?(handler: () => void): void;
}

export interface StripeConnectInitOptions {
  publishableKey: string;
  fetchClientSecret: () => Promise<string>;
}

export interface StripeConnectInstance {
  create(component: StripeConnectComponent): StripeConnectElement | null;
}

type StripeConnectLoader = (options: StripeConnectInitOptions) => StripeConnectInstance;

let cachedLoaderPromise: Promise<StripeConnectLoader> | null = null;

export async function loadStripeConnectAndInitialize(): Promise<StripeConnectLoader> {
  if (!cachedLoaderPromise) {
    cachedLoaderPromise = import('@stripe/connect-js')
      .then((mod: unknown) => {
        const loadFn = (mod as { loadConnectAndInitialize?: unknown }).loadConnectAndInitialize;
        if (typeof loadFn !== 'function') {
          throw new Error('Stripe Connect loader export is unavailable.');
        }
        return loadFn as StripeConnectLoader;
      })
      .catch((error: unknown) => {
        cachedLoaderPromise = null;
        const message = error instanceof Error ? error.message : 'Module could not be loaded.';
        throw new Error(`Stripe Connect is unavailable (${message}). Install @stripe/connect-js.`);
      });
  }

  return cachedLoaderPromise;
}
