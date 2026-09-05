"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { STRIPE_PUBLISHABLE_KEY } from "@/lib/config";
import {
  buyMembership,
  waitForMembershipPurchase,
  type MembershipPurchase,
} from "@/lib/marketplace";

// loadStripe() should only ever be called once, at module scope — not per render,
// and not per modal open (Stripe's own recommendation; recreating the instance
// throws away connection/config it caches internally).
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

type Props = {
  collectionId: string;
  priceCents: number;
  onClose: () => void;
  onResult: (purchase: MembershipPurchase) => void;
};

export default function MembershipCheckoutModal({ collectionId, priceCents, onClose, onResult }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create the PaymentIntent as soon as the modal opens — nothing is charged by
  // this call, it just gets a clientSecret for Elements to confirm against.
  useEffect(() => {
    let cancelled = false;
    buyMembership(collectionId, priceCents)
      .then((result) => {
        if (cancelled) return;
        setClientSecret(result.clientSecret);
        setPurchaseId(result.purchaseId);
      })
      .catch(() => !cancelled && setError("Couldn't start checkout. Please try again."));
    return () => {
      cancelled = true;
    };
  }, [collectionId, priceCents]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-slate-900/40 p-4 backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent dark:border-slate-800 dark:bg-slate-900 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Unlock for ${(priceCents / 100).toFixed(2)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {!STRIPE_PUBLISHABLE_KEY ? (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">
            Payments aren&apos;t configured (missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
          </p>
        ) : error ? (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : !clientSecret || !purchaseId ? (
          <div className="mt-6 flex items-center justify-center py-8">
            <svg className="h-6 w-6 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              // Match the app's own look instead of Stripe's default styling — see
              // https://docs.stripe.com/elements/appearance-api.
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#0d9488", // teal-600, same as the app's buttons
                  colorText: "#0f172a", // slate-900
                  colorTextPlaceholder: "#94a3b8", // slate-400
                  colorDanger: "#e11d48", // rose-600
                  fontFamily: "inherit",
                  borderRadius: "10px",
                  spacingUnit: "3px",
                },
              },
            }}
          >
            <CheckoutForm purchaseId={purchaseId} onClose={onClose} onResult={onResult} />
          </Elements>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          Test mode — try card number 4242 4242 4242 4242, any future date, any CVC.
        </p>
      </div>
    </div>
  );
}

function CheckoutForm({
  purchaseId,
  onClose,
  onResult,
}: {
  purchaseId: string;
  onClose: () => void;
  onResult: (purchase: MembershipPurchase) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setFormError(null);

    // redirect: "if_required" — a card payment never redirects, so this resolves
    // directly with the confirmed PaymentIntent instead of navigating away.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setFormError(error.message ?? "Payment failed. Please try a different card.");
      setSubmitting(false);
      return;
    }

    // Stripe confirmed the charge client-side — but the saga only actually starts
    // once our webhook hears about it too, which can lag this response by a beat.
    // waitForMembershipPurchase covers that gap by polling.
    setWaiting(true);
    void paymentIntent; // confirmed; the purchase record (not this object) is the source of truth
    try {
      const settled = await waitForMembershipPurchase(purchaseId);
      onResult(settled);
    } finally {
      setSubmitting(false);
      setWaiting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <PaymentElement
        options={{
          // NOTE: this only hides a standalone Link "express checkout" button — it does
          // NOT remove the "Secure, fast checkout with Link" enrollment prompt baked into
          // the card form (that one's account-wide, see dashboard.stripe.com/settings/payment_methods
          // per https://docs.stripe.com/payments/link/payment-element-link). Kept anyway
          // as the documented way to opt out of the part that *is* controllable here.
          wallets: { link: "never" },
        }}
      />
      {formError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {waiting ? "Finishing up…" : submitting ? "Paying…" : "Pay"}
        </button>
      </div>
    </form>
  );
}
