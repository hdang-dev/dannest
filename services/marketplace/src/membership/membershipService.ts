// The membership-purchase saga's marketplace half.
//
// Shape: create an unconfirmed PaymentIntent -> the buyer pays via a real Stripe
// Elements card form in the browser -> Stripe's webhook tells us the charge
// succeeded -> THAT is what actually starts the saga (charged, write outbox
// purchase_initiated) -> Core validates and replies -> settle (transfer the
// creator's cut) or refund. Two compensation paths once the saga is running: Core
// rejects (refund), or Core grants but the settle step itself fails, e.g. the
// creator never finished Connect onboarding (refund, and tell Core via
// mkt.membership.settle_failed so it can revoke the grant it already made — see
// MembershipRevokedListener on Core's side).
//
// Every handler below follows the same shape: do the fallible external work (a
// Stripe call) FIRST, and only claim the inbox event + commit local state once that
// has actually succeeded, inside one transaction. Claiming up front, before work
// that can still fail, would mark the event "done" forever the moment any one
// attempt hit a transient error — money charged or owed, with no record of it and
// no way to retry, since a redelivery (or a by-hand DLQ replay) would find the event
// already claimed and skip straight past it. Stripe idempotency keys on the outgoing
// calls are the other half of this: they make a genuine retry of the same logical
// step (a race between two deliveries, or a hand replay) reuse the original
// transfer/refund instead of moving money twice.
import { BadRequestError, NotFoundError } from "../errors";
import { claimInTransaction } from "../inbox/idempotency";
import { withTransaction } from "../db/transaction";
import { requireConnectedAccount } from "../connect/connectService";
import { stripe } from "../stripe/client";
import { writeOutboxEvent } from "../outbox/writer";
import { randomUUID } from "crypto";
import MembershipPurchase, { MembershipPurchaseDocument } from "./MembershipPurchase";
import { startSagaFromCharge } from "./sagaStart";

export interface InitiateMembershipInput {
  buyerId: string;
  collectionId: string;
  priceCents: number;
}

export interface InitiateMembershipResult {
  purchaseId: string;
  /** Hand this to Stripe Elements on the frontend — it's what lets the browser
   * confirm payment directly with Stripe, never touching our server with card data. */
  clientSecret: string;
}

/**
 * Create the PaymentIntent and the purchase row, both PENDING_PAYMENT — nothing is
 * charged yet. The saga doesn't start here; it starts when the webhook (see
 * webhookController) tells us the payment actually succeeded.
 */
export async function initiatePurchase(input: InitiateMembershipInput): Promise<InitiateMembershipResult> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: input.priceCents,
    currency: "usd",
    payment_method_types: ["card"],
    metadata: { buyerId: input.buyerId, collectionId: input.collectionId },
  });

  if (!paymentIntent.client_secret) {
    throw new BadRequestError("Stripe did not return a client secret");
  }

  const purchase = await MembershipPurchase.create({
    buyerId: input.buyerId,
    collectionId: input.collectionId,
    priceCents: input.priceCents,
    stripePaymentIntentId: paymentIntent.id,
    status: "PENDING_PAYMENT",
  });

  return { purchaseId: purchase.id, clientSecret: paymentIntent.client_secret };
}

export async function getPurchase(purchaseId: string): Promise<MembershipPurchaseDocument> {
  // findById throws (rather than resolving null) for a string that isn't even a
  // well-formed ObjectId — treat that the same as "not found" instead of a 500, since
  // it means a caller mistake (a stale/undefined id), not a server problem.
  let purchase;
  try {
    purchase = await MembershipPurchase.findById(purchaseId);
  } catch {
    throw new NotFoundError(`Purchase not found: ${purchaseId}`);
  }
  if (!purchase) throw new NotFoundError(`Purchase not found: ${purchaseId}`);
  return purchase;
}

/**
 * Called by the Stripe webhook (see webhookController) once payment truly succeeded —
 * this is where the saga's first step actually happens: mark CHARGED and queue
 * purchase_initiated. The `status !== "PENDING_PAYMENT"` guard is what actually makes
 * a webhook redelivery safe (a second delivery finds it already CHARGED and no-ops);
 * the inbox claim inside startSagaFromCharge is a second, belt-and-suspenders layer
 * for the narrow case of two deliveries racing each other before either has saved.
 */
export async function markChargedAndStartSaga(stripeEventId: string, paymentIntentId: string): Promise<void> {
  const purchase = await MembershipPurchase.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!purchase) {
    console.error(`payment_intent.succeeded for unknown PaymentIntent ${paymentIntentId}`);
    return;
  }
  if (purchase.status !== "PENDING_PAYMENT") return; // already handled

  await startSagaFromCharge(purchase, stripeEventId);
}

/** The card was declined, expired, etc. — nothing was ever charged, nothing to compensate. */
export async function markPaymentFailed(
  stripeEventId: string,
  paymentIntentId: string,
  reason: string | null,
): Promise<void> {
  const purchase = await MembershipPurchase.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!purchase || purchase.status !== "PENDING_PAYMENT") return;

  await withTransaction(async (session) => {
    if (!(await claimInTransaction(session, stripeEventId, "marketplace.stripe.webhook"))) return;
    purchase.status = "PAYMENT_FAILED";
    purchase.reason = reason;
    await purchase.save({ session });
  });
}

// ---- saga replies (Core's half of the round trip) ----

interface ActivatedPayload {
  eventId: string;
  purchaseId: string;
  ownerId: string;
}

interface RejectedPayload {
  eventId: string;
  purchaseId: string;
  reason: string;
}

/** Core granted the membership — pay the creator, or compensate if we can't. */
export async function handleActivated(payload: ActivatedPayload): Promise<void> {
  const purchase = await MembershipPurchase.findById(payload.purchaseId);
  if (!purchase) {
    console.error(`core.membership.activated for unknown purchase ${payload.purchaseId}`);
    return;
  }
  if (purchase.status !== "CHARGED") {
    return; // already settled/refunded — a purchase is worth guarding twice, it's money
  }

  let transfer;
  try {
    const account = await requireConnectedAccount(payload.ownerId);
    // A plain platform-balance -> connected-account transfer, not tied structurally to
    // the original charge (Stripe's "separate charges and transfers" pattern would use
    // transfer_group for that) — simpler, and enough to demonstrate the saga's settle
    // step without more Stripe-specific plumbing than the lesson needs. The idempotency
    // key means a genuine retry (two deliveries racing, or a hand replay from the DLQ)
    // reuses this same transfer instead of paying the creator twice.
    transfer = await stripe.transfers.create(
      { amount: purchase.priceCents, currency: "usd", destination: account.stripeAccountId },
      { idempotencyKey: `membership-transfer:${purchase.id}` },
    );
  } catch (err) {
    // Compensation #2: Core already granted access, but we can't pay the creator (e.g.
    // they never finished Connect onboarding). Refund the buyer, and tell Core via the
    // outbox so it can revoke the grant it already made.
    console.error(`Settle failed for purchase ${purchase.id}, refunding buyer:`, err);
    await stripe.refunds.create(
      { payment_intent: purchase.stripePaymentIntentId },
      { idempotencyKey: `membership-settle-refund:${purchase.id}` },
    );
    await withTransaction(async (session) => {
      if (!(await claimInTransaction(session, payload.eventId, "marketplace.membership"))) return;
      purchase.status = "REFUNDED";
      purchase.reason = "settle_failed";
      await purchase.save({ session });
      await writeOutboxEvent(session, "MEMBERSHIP_PURCHASE", purchase.id, "mkt.membership.settle_failed", {
        eventId: randomUUID(),
        purchaseId: purchase.id,
      });
    });
    return;
  }

  // The transfer already succeeded at this point — committing that fact is kept
  // outside the try/catch above on purpose. If THIS step fails (a Mongo hiccup, not
  // the transfer itself), the function throws normally and the caller redelivers;
  // retrying re-enters this same function with status still "CHARGED", so it repeats
  // the (idempotency-keyed, so safe) transfer call and then commits. Catching it here
  // instead would misread "couldn't save" as "couldn't pay the creator" and refund a
  // buyer whose creator was, in fact, already paid.
  await withTransaction(async (session) => {
    if (!(await claimInTransaction(session, payload.eventId, "marketplace.membership"))) return;
    purchase.status = "CONFIRMED";
    purchase.stripeTransferId = transfer.id;
    await purchase.save({ session });
  });
}

/** Core rejected the purchase — compensation #1: refund the buyer, nothing was ever granted. */
export async function handleRejected(payload: RejectedPayload): Promise<void> {
  const purchase = await MembershipPurchase.findById(payload.purchaseId);
  if (!purchase || purchase.status !== "CHARGED") return;

  await stripe.refunds.create(
    { payment_intent: purchase.stripePaymentIntentId },
    { idempotencyKey: `membership-reject-refund:${purchase.id}` },
  );
  await withTransaction(async (session) => {
    if (!(await claimInTransaction(session, payload.eventId, "marketplace.membership"))) return;
    purchase.status = "REFUNDED";
    purchase.reason = payload.reason;
    await purchase.save({ session });
  });
}
