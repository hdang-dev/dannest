"use client";

// Wakes core, marketplace, and notification in parallel instead of letting
// them wake serially, on demand, as features happen to need them (see
// instrumentation.ts for the server-side half of this). Two producers feed
// one shared "is anything warming up" store: the proactive pings below, and
// api.ts's doFetch, which flags a real request as "warming" if it's slow
// enough to plausibly be a cold Render service waking up. <WarmupBanner />
// is the single consumer — it shows while either producer has something in
// flight.

import { useEffect, useState } from "react";
import { HEALTH_ENDPOINTS } from "./config";

// Comfortably inside Render's 15-min idle timeout.
const RECHECK_INTERVAL_MS = 10 * 60 * 1000;
// Don't flash the banner for the common case where everything's already warm.
const BANNER_DELAY_MS = 400;
// Hard cap so a genuine outage (not just a slow wake) doesn't wedge the banner
// open. We don't have a solid number for Render's actual wake time, so this
// errs high rather than risk hiding the banner while a service is still cold.
const BANNER_MAX_MS = 60_000;
// Most warm requests resolve well under this; a cold wake takes ~30s, so this
// cleanly separates "probably cold" from "just a bit slow". Used by api.ts.
export const SLOW_REQUEST_MS = 700;

// --- shared store: how many warming-up operations are in flight right now ---
// Same lightweight callback-registry pattern as api.ts's onUnauthorized — a
// full React context would be overkill for one consumer plus one non-React
// producer (doFetch).

let warmingCount = 0;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

/** Call when a potentially-cold operation starts; call the returned function when it settles. */
export function beginWarming(): () => void {
  warmingCount++;
  notifyListeners();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    warmingCount--;
    notifyListeners();
  };
}

function subscribeWarming(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isWarming(): boolean {
  return warmingCount > 0;
}

// --- proactive background pings ---------------------------------------------

function pingAll(): Promise<unknown> {
  return Promise.allSettled(HEALTH_ENDPOINTS.map(({ url }) => fetch(url, { cache: "no-store" })));
}

/** Pings all three services and tracks it in the shared store, so the banner can react. */
function trackedPing(): void {
  const end = beginWarming();
  pingAll().finally(end);
}

function useServiceWarmup(): void {
  useEffect(() => {
    trackedPing(); // backstop for the server-side ping in instrumentation.ts

    function onVisibilityChange() {
      // Re-ping immediately on refocus — the 10-min interval alone could
      // leave a stale gap of up to 10 minutes after a long-hidden tab.
      if (document.visibilityState === "visible") trackedPing();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    const interval = setInterval(() => {
      // Silent — keeps a long-open session warm without flashing the banner.
      // No pings (and no Render instance-hours spent) while the tab is hidden.
      if (document.visibilityState === "visible") pingAll();
    }, RECHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, []);
}

// --- banner -------------------------------------------------------------

export function WarmupBanner() {
  useServiceWarmup();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    function handleChange() {
      if (isWarming()) {
        if (showTimer) return; // already scheduled
        showTimer = setTimeout(() => {
          setVisible(true);
          hideTimer = setTimeout(() => setVisible(false), BANNER_MAX_MS);
        }, BANNER_DELAY_MS);
      } else {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        showTimer = undefined;
        hideTimer = undefined;
        setVisible(false);
      }
    }

    handleChange(); // in case something's already warming by the time this mounts
    const unsubscribe = subscribeWarming(handleChange);

    return () => {
      unsubscribe();
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-teal-200 bg-teal-50/95 px-4 py-2 text-sm font-medium text-teal-800 dark:border-teal-900 dark:bg-teal-950/90 dark:text-teal-200"
    >
      <span
        className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
      Running on free-tier hosting — some services are waking up, this can take a little while…
    </div>
  );
}
