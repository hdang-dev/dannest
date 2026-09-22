import { describe, it, expect, vi, beforeEach } from "vitest";
import { startSagaFromCharge } from "../sagaStart.service";
import { claim } from "../inbox.service";
import { writeOutboxEvent } from "../outbox.service";
import type { MembershipPurchaseDocument } from "../../models/MembershipPurchase";

vi.mock("../inbox.service", () => ({ claim: vi.fn() }));
vi.mock("../outbox.service", () => ({ writeOutboxEvent: vi.fn() }));
vi.mock("../../db/transaction", () => ({
  withTransaction: vi.fn((fn: (session: unknown) => unknown) => fn({})),
}));

beforeEach(() => {
  vi.mocked(claim).mockReset();
  vi.mocked(writeOutboxEvent).mockReset();
});

describe("startSagaFromCharge", () => {
  const purchase = {
    id: "purchase-1",
    buyerId: "buyer-1",
    collectionId: "col-1",
    priceCents: 500,
    status: "PENDING_PAYMENT",
    save: vi.fn(),
  } as unknown as MembershipPurchaseDocument;

  it("marks the purchase CHARGED and queues the outbox event", async () => {
    vi.mocked(claim).mockResolvedValue(true);

    await startSagaFromCharge(purchase, "evt-1");

    expect(purchase.status).toBe("CHARGED");
    expect(purchase.save).toHaveBeenCalled();
    expect(writeOutboxEvent).toHaveBeenCalledWith(
      expect.anything(),
      "MEMBERSHIP_PURCHASE",
      "purchase-1",
      "marketplace.membership.charged",
      expect.objectContaining({ purchaseId: "purchase-1" }),
    );
  });

  it("does nothing on a redelivery of the same charge event", async () => {
    vi.mocked(claim).mockResolvedValue(false);

    await startSagaFromCharge(purchase, "evt-1");

    expect(writeOutboxEvent).not.toHaveBeenCalled();
  });
});
