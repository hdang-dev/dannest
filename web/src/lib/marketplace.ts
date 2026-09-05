// Client for the marketplace API (/api/v1/marketplace/*) — a separate service, own
// origin (see services/marketplace/). Three things live here: starting a real Stripe
// checkout for a MEMBERS_ONLY collection, polling its outcome, and a creator
// connecting their Stripe account to receive payouts.

import { apiFetch } from "./api";
import { MARKETPLACE_API_URL } from "./config";

export type MembershipPurchaseStatus =
  | "PENDING_PAYMENT" // waiting on the buyer to complete the card form
  | "PAYMENT_FAILED" // card declined etc. — nothing was charged
  | "CHARGED" // payment succeeded, the saga is running (Core hasn't replied yet)
  | "CONFIRMED" // Core granted access and the creator got paid
  | "REFUNDED"; // Core rejected, or paying the creator failed — buyer got their money back

export type MembershipPurchase = {
  _id: string;
  buyerId: string;
  collectionId: string;
  priceCents: number;
  status: MembershipPurchaseStatus;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

// POST's response shape is NOT the same as the GET-by-id document above — the
// controller returns just {purchaseId, clientSecret}, not the full document (see
// membershipController.initiate). Mixing these up polls /memberships/undefined.
export type InitiateMembershipResult = {
  purchaseId: string;
  /** Hand this straight to Stripe Elements — see MembershipCheckoutModal. */
  clientSecret: string;
};

/** POST /api/v1/marketplace/memberships — creates the PaymentIntent, charges nothing yet. */
export function buyMembership(
  collectionId: string,
  priceCents: number,
): Promise<InitiateMembershipResult> {
  return apiFetch<InitiateMembershipResult>(
    `/api/v1/marketplace/memberships`,
    { method: "POST", body: JSON.stringify({ collectionId, priceCents }) },
    MARKETPLACE_API_URL,
  );
}

/** GET /api/v1/marketplace/memberships/{id} — poll until status leaves PENDING_PAYMENT/CHARGED. */
export function getMembershipPurchase(purchaseId: string): Promise<MembershipPurchase> {
  return apiFetch<MembershipPurchase>(
    `/api/v1/marketplace/memberships/${purchaseId}`,
    {},
    MARKETPLACE_API_URL,
  );
}

/**
 * Poll a purchase every second until the saga finishes (or `timeoutMs` elapses) — it's
 * asynchronous end to end, there's no single request/response that returns the final
 * result. Call this only *after* Stripe Elements has confirmed the card payment
 * client-side; PENDING_PAYMENT is expected to still show briefly while the webhook
 * catches up.
 */
export async function waitForMembershipPurchase(
  purchaseId: string,
  timeoutMs = 15000,
): Promise<MembershipPurchase> {
  const start = Date.now();
  let purchase = await getMembershipPurchase(purchaseId);
  while (
    (purchase.status === "PENDING_PAYMENT" || purchase.status === "CHARGED") &&
    Date.now() - start < timeoutMs
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    purchase = await getMembershipPurchase(purchaseId);
  }
  return purchase;
}

export type ConnectStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

/** POST /api/v1/marketplace/connect/onboard — returns a fresh Stripe-hosted onboarding link. */
export function startConnectOnboarding(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(
    `/api/v1/marketplace/connect/onboard`,
    { method: "POST" },
    MARKETPLACE_API_URL,
  );
}

/** GET /api/v1/marketplace/connect/status — whether the caller can receive payouts yet. */
export function getConnectStatus(): Promise<ConnectStatus> {
  return apiFetch<ConnectStatus>(`/api/v1/marketplace/connect/status`, {}, MARKETPLACE_API_URL);
}
