import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getStripe } from '../lib/stripe';
import { useToast } from '../components/feedback/ToastProvider';

/**
 * Client helpers that call the Supabase Edge Functions responsible for
 * Stripe Checkout and the Customer Portal. The functions run server-side
 * with the Stripe secret key; the browser only ever gets a redirect URL.
 */
export function useBilling() {
  const toast = useToast();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  async function startCheckout() {
    setLoadingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        url?: string;
        sessionId?: string;
      }>('stripe-checkout', { body: {} });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      if (data?.sessionId) {
        const stripe = await getStripe();
        if (!stripe) throw new Error('Stripe failed to load.');
        const { error: redirectError } = await stripe.redirectToCheckout({
          sessionId: data.sessionId,
        });
        if (redirectError) throw redirectError;
        return;
      }

      throw new Error('No checkout URL returned.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not start checkout. Please try again.',
      );
    } finally {
      setLoadingCheckout(false);
    }
  }

  async function openCustomerPortal() {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string }>(
        'create-portal-session',
        { body: {} },
      );
      if (error) throw error;
      if (!data?.url) throw new Error('No portal URL returned.');
      window.location.href = data.url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not open the billing portal. Try again.',
      );
    } finally {
      setLoadingPortal(false);
    }
  }

  return { startCheckout, openCustomerPortal, loadingCheckout, loadingPortal };
}
