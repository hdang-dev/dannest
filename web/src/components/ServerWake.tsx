"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/config";

// Render free/starter services spin down after inactivity, so the first request
// after a while pays a 30–60s cold-start penalty. We ping the public health
// endpoint once on app load; if it doesn't answer quickly we surface a modal so
// the user knows the wait is the server waking up — not a frozen app.

const HEALTH_URL = `${API_URL}/actuator/health`;

// Show the modal only once a request is slow enough to be a cold start.
const SLOW_THRESHOLD_MS = 3000;
// Abort and retry an individual ping that hangs this long.
const ATTEMPT_TIMEOUT_MS = 12000;
// Wait between retries while the service is still coming up.
const RETRY_DELAY_MS = 2000;

type Phase = "checking" | "waking" | "ready";

async function pingHealth(signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export default function ServerWake() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [seconds, setSeconds] = useState(0);

  const startedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    startedAt.current = performance.now();

    // Flip to the "waking" UI only if we cross the slow threshold.
    const slowTimer = setTimeout(() => {
      if (!cancelled) setPhase((p) => (p === "ready" ? p : "waking"));
    }, SLOW_THRESHOLD_MS);

    // Tick the elapsed-seconds counter shown in the modal.
    const ticker = setInterval(() => {
      if (!cancelled) {
        setSeconds(Math.floor((performance.now() - startedAt.current) / 1000));
      }
    }, 1000);

    (async () => {
      // Keep retrying until the service answers ok — during a cold start early
      // pings may hang or return 502 before the app is ready.
      while (!cancelled) {
        const controller = new AbortController();
        const attemptTimeout = setTimeout(
          () => controller.abort(),
          ATTEMPT_TIMEOUT_MS,
        );
        const ok = await pingHealth(controller.signal);
        clearTimeout(attemptTimeout);

        if (cancelled) return;
        if (ok) {
          setPhase("ready");
          return;
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearInterval(ticker);
    };
  }, []);

  if (phase !== "waking") return null;

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-label="Server is starting up"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-slate-900">
        <div
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-500 dark:border-slate-700 dark:border-t-teal-400"
          aria-hidden
        />
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Waking up the server…
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {seconds < 15
            ? "The server was asleep and is starting back up. This can take up to a minute on the first visit."
            : "Almost there — hang tight, this is nearly done."}
        </p>
        <p className="mt-3 text-xs tabular-nums text-slate-400 dark:text-slate-500">
          {seconds}s
        </p>
      </div>
    </div>
  );
}
