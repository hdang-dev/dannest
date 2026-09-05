// The membership-purchase saga's marketplace half. Shape (see docs/lessons once
// written): charge the buyer to the platform's own Stripe balance -> publish
// purchase_initiated -> Core validates and replies -> settle (transfer the creator's
// cut) or refund. Two compensation paths: Core rejects (refund), or Core grants but the
// settle step itself fails, e.g. the creator never finished Connect onboarding (refund
// AND, eventually, tell Core to revoke — that revoke listener is phase 5, not built yet).
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { BadRequestError, NotFoundError } from "../errors";
import { claim } from "../inbox/idempotency";
import { writeOutboxEvent } from "../outbox/writer";
import { requireConnectedAccount } from "../connect/connectService";
import { stripe } from "../stripe/client";
import MembershipPurchase, { MembershipPurchaseDocument } from "./MembershipPurchase";

// Stripe's built-in test-mode token — stands in for what a real frontend's Stripe
// Elements would supply via createPaymentMethod(). Used only if the caller doesn't send
// one, which is always true today since there's no UI yet.
const TEST_PAYMENT_METHOD = "pm_card_visa";

export interface InitiateMembershipInput {
  buyerId: string;
  collectionId: string;
  priceCents: number;
  paymentMethodId?: string;
}

export interface InitiateMembershipResult {
  purchaseId: string;
  status: string;
}

/** Charge the buyer, then atomically record the purchase + queue the saga's first event. */
export async function initiatePurchase(input: InitiateMembershipInput): Promise<InitiateMembershipResult> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: input.priceCents,
    currency: "usd",
    payment_method: input.paymentMethodId ?? TEST_PAYMENT_METHOD,
    payment_method_types: ["card"],
    confirm: true,
    metadata: { buyerId: input.buyerId, collectionId: input.collectionId },
  });

  if (paymentIntent.status !== "succeeded") {
    // Nothing written yet — no compensation needed, there's nothing to undo.
    throw new BadRequestError(`Payment did not complete (status: ${paymentIntent.status})`);
  }

  const session = await mongoose.startSession();
  let purchase: MembershipPurchaseDocument;
  try {
    purchase = await session.withTransaction(async () => {
      const [created] = await MembershipPurchase.create(
        [
          {
            buyerId: input.buyerId,
            collectionId: input.collectionId,
            priceCents: input.priceCents,
            stripePaymentIntentId: paymentIntent.id,
            status: "CHARGED",
          },
        ],
        { session },
      );
      await writeOutboxEvent(session, "MEMBERSHIP_PURCHASE", created.id, "mkt.membership.purchase_initiated", {
        eventId: randomUUID(),
        purchaseId: created.id,
        buyerId: input.buyerId,
        collectionId: input.collectionId,
        priceCents: input.priceCents,
      });
      return created;
    });
  } finally {
    await session.endSession();
  }

  return { purchaseId: purchase.id, status: purchase.status };
}

export async function getPurchase(purchaseId: string): Promise<MembershipPurchaseDocument> {
  const purchase = await MembershipPurchase.findById(purchaseId);
  if (!purchase) throw new NotFoundError(`Purchase not found: ${purchaseId}`);
  return purchase;
}

// ---- saga replies ----

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
  if (!(await claim(payload.eventId, "marketplace.membership"))) return;

  const purchase = await MembershipPurchase.findById(payload.purchaseId);
  if (!purchase) {
    console.error(`core.membership.activated for unknown purchase ${payload.purchaseId}`);
    return;
  }
  if (purchase.status !== "CHARGED") {
    return; // already settled/refunded — a purchase is worth guarding twice, it's money
  }

  try {
    const account = await requireConnectedAccount(payload.ownerId);
    // A plain platform-balance -> connected-account transfer, not tied structurally to
    // the original charge (Stripe's "separate charges and transfers" pattern would use
    // transfer_group for that) — simpler, and enough to demonstrate the saga's settle
    // step without more Stripe-specific plumbing than the lesson needs.
    const transfer = await stripe.transfers.create({
      amount: purchase.priceCents,
      currency: "usd",
      destination: account.stripeAccountId,
    });
    purchase.status = "CONFIRMED";
    purchase.stripeTransferId = transfer.id;
    await purchase.save();
  } catch (err) {
    // Compensation #2: Core already granted access, but we can't pay the creator (e.g.
    // they never finished Connect onboarding). Refund the buyer — and Core needs to
    // hear about it so it can revoke the grant it already made (phase 5: not built yet,
    // so today this leaves a real, documented inconsistency window until that exists).
    console.error(`Settle failed for purchase ${purchase.id}, refunding buyer:`, err);
    await stripe.refunds.create({ payment_intent: purchase.stripePaymentIntentId });
    purchase.status = "REFUNDED";
    purchase.reason = "settle_failed";
    await purchase.save();
  }
}

/** Core rejected the purchase — compensation #1: refund the buyer, nothing was ever granted. */
export async function handleRejected(payload: RejectedPayload): Promise<void> {
  if (!(await claim(payload.eventId, "marketplace.membership"))) return;

  const purchase = await MembershipPurchase.findById(payload.purchaseId);
  if (!purchase || purchase.status !== "CHARGED") return;

  await stripe.refunds.create({ payment_intent: purchase.stripePaymentIntentId });
  purchase.status = "REFUNDED";
  purchase.reason = payload.reason;
  await purchase.save();
}
