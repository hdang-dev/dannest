"use client";

// A creator's Stripe Connect status, and the entry point into onboarding — this is
// what CollectionFormModal's "connect Stripe first" gate is pointing at. Once
// payoutsEnabled flips true here, the members-only option unlocks there.
import { useEffect, useState } from "react";
import { getConnectStatus, startConnectOnboarding, type ConnectStatus } from "@/lib/marketplace";

export default function ConnectSettingsCard() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConnectStatus()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    setRedirecting(true);
    setError(null);
    try {
      const { url } = await startConnectOnboarding();
      window.location.href = url;
    } catch {
      setError("Couldn't start Stripe setup. Please try again.");
      setRedirecting(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Payments</h2>

      {loadError ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Couldn&apos;t load your payment setup.
        </p>
      ) : !status ? (
        <p className="mt-2 text-sm text-slate-400">Loading…</p>
      ) : status.payoutsEnabled ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 12l5 5L20 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Stripe connected — you can create members-only collections.
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {status.connected
              ? "Your Stripe setup isn't finished yet — finish it to start creating members-only collections and get paid."
              : "Connect a Stripe account to create members-only collections and get paid when someone unlocks one."}
          </p>
          <button
            type="button"
            onClick={connect}
            disabled={redirecting}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {redirecting ? "Redirecting…" : status.connected ? "Finish setup" : "Connect Stripe"}
          </button>
          {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </>
      )}
    </div>
  );
}
