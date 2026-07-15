import { useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { getStripe } from '../lib/stripe';
import { useToast } from '../components/feedback/ToastProvider';

/**
 * Extracts a human-readable message from an Edge Function failure. On a
 * non-2xx response, supabase-js throws a FunctionsHttpError whose `.context`
 * is the raw Response — our functions reply with `{ error: "..." }`, so we read
 * that instead of showing the generic "non-2xx status code" message.
 */
async function toErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      if (body && typeof body.error === 'string') return body.error;
    } catch {
      // response wasn't JSON; fall through to the generic message
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * Client helpers that call the Supabase Edge Functions responsible for
 * Stripe Checkout and the Customer Portal. The functions run server-side
 * with the Stripe secret key; the browser only ever gets a redirect URL.
 */
export function useBilling() {
  const toast = useToast();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  /**
   * Returns the current user's access token so it can be forwarded to the
   * Edge Functions as `Authorization: Bearer <jwt>`. The functions identify
   * the user from this validated token (never from client-supplied IDs), so
   * we must make sure it's actually sent.
   */
  async function getAccessToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    return session.access_token;
  }

  async function startCheckout() {
    setLoadingCheckout(true);
    try {
      const token = await getAccessToken();
      const { data, error } = await supabase.functions.invoke<{
        url?: string;
        sessionId?: string;
        trial?: {
          requested: boolean;
          applied: boolean;
          decision: 'allow' | 'review' | 'block';
          reason_code: string;
          paid_checkout_available: boolean;
        };
      }>('stripe-checkout', {
        body: { trial: true },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw error;

      if (data?.trial?.requested && !data.trial.applied) {
        toast.info(
          data.trial.decision === 'review'
            ? 'Your trial request needs review. You can continue with paid checkout now.'
            : 'A free trial is not available for this account. Paid checkout is still available.',
        );
      } else if (data?.trial?.applied) {
        toast.success('Free trial applied to this checkout.');
      }

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
      toast.error(await toErrorMessage(err, 'Could not start checkout. Please try again.'));
    } finally {
      setLoadingCheckout(false);
    }
  }

  async function openCustomerPortal() {
    setLoadingPortal(true);
    try {
      const token = await getAccessToken();
      const { data, error } = await supabase.functions.invoke<{ url?: string }>(
        'create-portal-session',
        {
          body: {},
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (error) throw error;
      if (!data?.url) throw new Error('No portal URL returned.');
      window.location.href = data.url;
    } catch (err) {
      toast.error(await toErrorMessage(err, 'Could not open the billing portal. Try again.'));
    } finally {
      setLoadingPortal(false);
    }
  }

  return { startCheckout, openCustomerPortal, loadingCheckout, loadingPortal };
}
