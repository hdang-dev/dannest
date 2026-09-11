"use client";

// Wakes core, marketplace, and notification in parallel instead of letting
// them wake serially, on demand, as features happen to need them (see
// instrumentation.ts for the server-side half of this). <WarmupBanner/>
// shows for as long as any of the three pings is still outstanding — no
// hard cap, since hiding it early just means lying about being ready while
// the app still doesn't work.

import { useEffect, useState } from "react";
import { HEALTH_ENDPOINTS } from "./config";

// Comfortably inside Render's 15-min idle timeout.
const RECHECK_INTERVAL_MS = 10 * 60 * 1000;
// Don't flash the banner for the common case where everything's already warm.
const BANNER_DELAY_MS = 400;

let warmingCount = 0;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function subscribeWarming(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isWarming(): boolean {
  return warmingCount > 0;
}

function pingAll(): Promise<unknown> {
  return Promise.allSettled(HEALTH_ENDPOINTS.map(({ url }) => fetch(url, { cache: "no-store" })));
}

/** Pings all three services and tracks it, so the banner can react. */
function trackedPing(): void {
  warmingCount++;
  notifyListeners();
  pingAll().finally(() => {
    warmingCount--;
    notifyListeners();
  });
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

export function WarmupBanner() {
  useServiceWarmup();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;

    function handleChange() {
      if (isWarming()) {
        if (showTimer) return; // already scheduled
        showTimer = setTimeout(() => setVisible(true), BANNER_DELAY_MS);
      } else {
        clearTimeout(showTimer);
        showTimer = undefined;
        setVisible(false);
      }
    }

    handleChange(); // in case something's already warming by the time this mounts
    const unsubscribe = subscribeWarming(handleChange);

    return () => {
      unsubscribe();
      clearTimeout(showTimer);
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
