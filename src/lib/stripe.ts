import { loadStripe, type Stripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<Stripe | null> | null = null;

/** Lazily load Stripe.js so it's only fetched when a checkout is initiated. */
export function getStripe(): Promise<Stripe | null> {
  if (!publishableKey) {
    // eslint-disable-next-line no-console
    console.error('Missing VITE_STRIPE_PUBLISHABLE_KEY.');
    return Promise.resolve(null);
  }
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

export const MONTHLY_PRICE_USD = 99;
export const MONTHLY_PRICE_LABEL = `$${MONTHLY_PRICE_USD.toFixed(2)}`;

