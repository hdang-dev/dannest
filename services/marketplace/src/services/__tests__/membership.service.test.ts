import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  initiatePurchase,
  getPurchase,
  markChargedAndStartSaga,
  markPaymentFailed,
  handleActivated,
  handleRejected,
} from "../membership.service";
import MembershipPurchase from "../../models/MembershipPurchase";
import { stripe } from "../../stripe/client";
import { claim } from "../inbox.service";
import { requireConnectedAccount } from "../connect.service";
import { startSagaFromCharge } from "../sagaStart.service";
import { writeOutboxEvent } from "../outbox.service";
import { BadRequestError, NotFoundError } from "../../errors";

vi.mock("../../models/MembershipPurchase", () => ({
  default: { create: vi.fn(), findOne: vi.fn(), findById: vi.fn() },
}));
vi.mock("../../stripe/client", () => ({
  stripe: {
    paymentIntents: { create: vi.fn() },
    transfers: { create: vi.fn() },
    refunds: { create: vi.fn() },
  },
}));
vi.mock("../inbox.service", () => ({ claim: vi.fn() }));
vi.mock("../connect.service", () => ({ requireConnectedAccount: vi.fn() }));
vi.mock("../sagaStart.service", () => ({ startSagaFromCharge: vi.fn() }));
vi.mock("../outbox.service", () => ({ writeOutboxEvent: vi.fn() }));
// withTransaction just runs the callback for real transaction mechanics — that's
// already covered by inbox.service's integration test. Here it's only plumbing.
vi.mock("../../db/transaction", () => ({
  withTransaction: vi.fn((fn: (session: unknown) => unknown) => fn({})),
}));

beforeEach(() => {
  vi.mocked(MembershipPurchase.create).mockReset();
  vi.mocked(MembershipPurchase.findOne).mockReset();
  vi.mocked(MembershipPurchase.findById).mockReset();
  vi.mocked(stripe.paymentIntents.create).mockReset();
  vi.mocked(stripe.transfers.create).mockReset();
  vi.mocked(stripe.refunds.create).mockReset();
  vi.mocked(claim).mockReset();
  vi.mocked(requireConnectedAccount).mockReset();
  vi.mocked(startSagaFromCharge).mockReset();
  vi.mocked(writeOutboxEvent).mockReset();
});

describe("initiatePurchase", () => {
  it("creates a PaymentIntent and a PENDING_PAYMENT purchase row", async () => {
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({
      id: "pi_1",
      client_secret: "secret_1",
    } as never);
    vi.mocked(MembershipPurchase.create).mockResolvedValue({ id: "purchase-1" } as never);

    const result = await initiatePurchase({ buyerId: "buyer-1", collectionId: "col-1", priceCents: 500 });

    expect(MembershipPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING_PAYMENT", stripePaymentIntentId: "pi_1" }),
    );
    expect(result).toEqual({ purchaseId: "purchase-1", clientSecret: "secret_1" });
  });

  it("throws if Stripe doesn't return a client secret", async () => {
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({ id: "pi_1", client_secret: null } as never);

    await expect(
      initiatePurchase({ buyerId: "buyer-1", collectionId: "col-1", priceCents: 500 }),
    ).rejects.toThrow(BadRequestError);
  });
});

describe("getPurchase", () => {
  it("returns the purchase when found", async () => {
    const purchase = { id: "purchase-1" };
    vi.mocked(MembershipPurchase.findById).mockResolvedValue(purchase as never);

    await expect(getPurchase("purchase-1")).resolves.toBe(purchase);
  });

  it("throws NotFoundError when there's no such purchase", async () => {
    vi.mocked(MembershipPurchase.findById).mockResolvedValue(null);

    await expect(getPurchase("purchase-1")).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError (not a 500) for a malformed id", async () => {
    vi.mocked(MembershipPurchase.findById).mockRejectedValue(new Error("Cast to ObjectId failed"));

    await expect(getPurchase("not-an-id")).rejects.toThrow(NotFoundError);
  });
});

describe("markChargedAndStartSaga", () => {
  it("does nothing for an unknown PaymentIntent", async () => {
    vi.mocked(MembershipPurchase.findOne).mockResolvedValue(null);

    await markChargedAndStartSaga("evt-1", "pi_1");

    expect(startSagaFromCharge).not.toHaveBeenCalled();
  });

  it("does nothing if the purchase already moved on from PENDING_PAYMENT", async () => {
    vi.mocked(MembershipPurchase.findOne).mockResolvedValue({ status: "CHARGED" } as never);

    await markChargedAndStartSaga("evt-1", "pi_1");

    expect(startSagaFromCharge).not.toHaveBeenCalled();
  });

  it("starts the saga for a PENDING_PAYMENT purchase", async () => {
    const purchase = { status: "PENDING_PAYMENT" };
    vi.mocked(MembershipPurchase.findOne).mockResolvedValue(purchase as never);

    await markChargedAndStartSaga("evt-1", "pi_1");

    expect(startSagaFromCharge).toHaveBeenCalledWith(purchase, "evt-1");
  });
});

describe("markPaymentFailed", () => {
  it("does nothing if the purchase isn't PENDING_PAYMENT", async () => {
    vi.mocked(MembershipPurchase.findOne).mockResolvedValue({ status: "CHARGED" } as never);

    await markPaymentFailed("evt-1", "pi_1", "card_declined");

    expect(claim).not.toHaveBeenCalled();
  });

  it("marks the purchase PAYMENT_FAILED with the given reason", async () => {
    const purchase = { status: "PENDING_PAYMENT", save: vi.fn() };
    vi.mocked(MembershipPurchase.findOne).mockResolvedValue(purchase as never);
    vi.mocked(claim).mockResolvedValue(true);

    await markPaymentFailed("evt-1", "pi_1", "card_declined");

    expect(purchase.status).toBe("PAYMENT_FAILED");
    expect(purchase.save).toHaveBeenCalled();
  });

  it("skips the write on a redelivery (claim returns false)", async () => {
    const purchase = { status: "PENDING_PAYMENT", save: vi.fn() };
    vi.mocked(MembershipPurchase.findOne).mockResolvedValue(purchase as never);
    vi.mocked(claim).mockResolvedValue(false);

    await markPaymentFailed("evt-1", "pi_1", "card_declined");

    expect(purchase.save).not.toHaveBeenCalled();
  });
});

describe("handleActivated", () => {
  const payload = { eventId: "evt-1", purchaseId: "purchase-1", ownerId: "owner-1" };

  it("does nothing for an unknown purchase", async () => {
    vi.mocked(MembershipPurchase.findById).mockResolvedValue(null);

    await handleActivated(payload);

    expect(requireConnectedAccount).not.toHaveBeenCalled();
  });

  it("does nothing if the purchase was already settled or refunded", async () => {
    vi.mocked(MembershipPurchase.findById).mockResolvedValue({ status: "CONFIRMED" } as never);

    await handleActivated(payload);

    expect(requireConnectedAccount).not.toHaveBeenCalled();
  });

  it("pays the creator and confirms the purchase on the happy path", async () => {
    const purchase = { status: "CHARGED", priceCents: 500, save: vi.fn() };
    vi.mocked(MembershipPurchase.findById).mockResolvedValue(purchase as never);
    vi.mocked(requireConnectedAccount).mockResolvedValue({ stripeAccountId: "acct_1" } as never);
    vi.mocked(stripe.transfers.create).mockResolvedValue({ id: "tr_1" } as never);
    vi.mocked(claim).mockResolvedValue(true);

    await handleActivated(payload);

    expect(purchase.status).toBe("CONFIRMED");
    expect((purchase as unknown as { stripeTransferId: string }).stripeTransferId).toBe("tr_1");
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("refunds the buyer and flags a payout failure if the creator has no connected account", async () => {
    const purchase = { id: "purchase-1", status: "CHARGED", priceCents: 500, save: vi.fn() };
    vi.mocked(MembershipPurchase.findById).mockResolvedValue(purchase as never);
    vi.mocked(requireConnectedAccount).mockRejectedValue(new BadRequestError("no account"));
    vi.mocked(claim).mockResolvedValue(true);

    await handleActivated(payload);

    expect(stripe.refunds.create).toHaveBeenCalled();
    expect(purchase.status).toBe("REFUNDED");
    expect((purchase as unknown as { reason: string }).reason).toBe("no_connected_account");
    expect(writeOutboxEvent).toHaveBeenCalledWith(
      expect.anything(),
      "MEMBERSHIP_PURCHASE",
      "purchase-1",
      "marketplace.membership.payout-failed",
      expect.anything(),
    );
  });

  it("refunds the buyer with a different reason when the transfer itself fails", async () => {
    const purchase = { status: "CHARGED", priceCents: 500, save: vi.fn() };
    vi.mocked(MembershipPurchase.findById).mockResolvedValue(purchase as never);
    vi.mocked(requireConnectedAccount).mockResolvedValue({ stripeAccountId: "acct_1" } as never);
    vi.mocked(stripe.transfers.create).mockRejectedValue(new Error("Stripe balance too low"));
    vi.mocked(claim).mockResolvedValue(true);

    await handleActivated(payload);

    expect(purchase.status).toBe("REFUNDED");
    expect((purchase as unknown as { reason: string }).reason).toBe("settle_failed");
  });
});

describe("handleRejected", () => {
  const payload = { eventId: "evt-1", purchaseId: "purchase-1", reason: "policy_violation" };

  it("does nothing for a purchase that isn't CHARGED", async () => {
    vi.mocked(MembershipPurchase.findById).mockResolvedValue({ status: "CONFIRMED" } as never);

    await handleRejected(payload);

    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("refunds the buyer and marks the purchase REFUNDED", async () => {
    const purchase = { status: "CHARGED", save: vi.fn() };
    vi.mocked(MembershipPurchase.findById).mockResolvedValue(purchase as never);
    vi.mocked(claim).mockResolvedValue(true);

    await handleRejected(payload);

    expect(stripe.refunds.create).toHaveBeenCalled();
    expect(purchase.status).toBe("REFUNDED");
    expect((purchase as unknown as { reason: string }).reason).toBe("policy_violation");
  });
});
