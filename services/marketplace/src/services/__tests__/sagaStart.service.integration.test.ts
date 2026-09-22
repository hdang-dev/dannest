import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startSagaFromCharge } from "../sagaStart.service";
import MembershipPurchase from "../../models/MembershipPurchase";
import OutboxEvent from "../../models/OutboxEvent";
import InboxEvent from "../../models/InboxEvent";
import { startMongoMemory, stopMongoMemory } from "../../test/mongoMemoryReplSet";

beforeAll(async () => {
  await startMongoMemory();
  await InboxEvent.init();
});

afterAll(stopMongoMemory);

beforeEach(async () => {
  await MembershipPurchase.deleteMany({});
  await OutboxEvent.deleteMany({});
  await InboxEvent.deleteMany({});
});

describe("startSagaFromCharge (integration, real MongoDB)", () => {
  it("charges the purchase and queues the outbox event exactly once, even on redelivery", async () => {
    const purchase = await MembershipPurchase.create({
      buyerId: "buyer-1",
      collectionId: "col-1",
      priceCents: 500,
      stripePaymentIntentId: "pi_1",
      status: "PENDING_PAYMENT",
    });

    await startSagaFromCharge(purchase, "evt-1");
    await startSagaFromCharge(purchase, "evt-1"); // same webhook delivered twice

    const reloaded = await MembershipPurchase.findById(purchase.id);
    expect(reloaded?.status).toBe("CHARGED");

    const outboxEvents = await OutboxEvent.find({ aggregateId: purchase.id });
    expect(outboxEvents).toHaveLength(1);
    expect(outboxEvents[0].eventType).toBe("marketplace.membership.charged");
  });
});
