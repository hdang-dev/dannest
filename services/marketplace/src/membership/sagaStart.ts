// The actual first step of the membership saga — split out from membershipService.ts
// only so it's obvious this is a distinct moment: not "the buyer clicked buy" (that's
// initiatePurchase, which merely sets up a PaymentIntent) but "Stripe confirmed the
// charge really happened". Everything downstream (Core validating/granting/rejecting)
// depends on this having actually run.
import { randomUUID } from "crypto";
import { withTransaction } from "../db/transaction";
import { claimInTransaction } from "../inbox/idempotency";
import { writeOutboxEvent } from "../outbox/writer";
import { MembershipPurchaseDocument } from "./MembershipPurchase";

export async function startSagaFromCharge(
  purchase: MembershipPurchaseDocument,
  stripeEventId: string,
): Promise<void> {
  await withTransaction(async (session) => {
    // Claimed here, atomically with the state it guards — not before, in
    // markChargedAndStartSaga — so a transient failure partway through this
    // transaction leaves the event unclaimed instead of silently and permanently
    // dropping a charge Stripe already took.
    if (!(await claimInTransaction(session, stripeEventId, "marketplace.stripe.webhook"))) return;
    purchase.status = "CHARGED";
    await purchase.save({ session });
    await writeOutboxEvent(
      session,
      "MEMBERSHIP_PURCHASE",
      purchase.id,
      "mkt.membership.purchase_initiated",
      {
        eventId: randomUUID(),
        purchaseId: purchase.id,
        buyerId: purchase.buyerId,
        collectionId: purchase.collectionId,
        priceCents: purchase.priceCents,
      },
    );
  });
}
