import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { handle } from "../webhook.controller";
import { stripe } from "../../stripe/client";
import * as membershipService from "../../services/membership.service";
import { BadRequestError } from "../../errors";

vi.mock("../../stripe/client", () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
}));
vi.mock("../../services/membership.service", () => ({
  markChargedAndStartSaga: vi.fn(),
  markPaymentFailed: vi.fn(),
}));
vi.mock("../../config/env", () => ({
  env: { stripe: { webhookSecret: "whsec_test" } },
}));

function fakeReq(signature?: string): Request {
  return { headers: signature ? { "stripe-signature": signature } : {}, body: Buffer.from("{}") } as Request;
}

function fakeRes() {
  return { json: vi.fn() } as unknown as Response;
}

beforeEach(() => {
  vi.mocked(stripe.webhooks.constructEvent).mockReset();
  vi.mocked(membershipService.markChargedAndStartSaga).mockReset();
  vi.mocked(membershipService.markPaymentFailed).mockReset();
});

describe("webhook handle", () => {
  it("rejects a request with no Stripe signature", async () => {
    await expect(handle(fakeReq(), fakeRes())).rejects.toThrow(BadRequestError);
  });

  it("rejects a request whose signature doesn't verify", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
      throw new Error("bad signature");
    });

    await expect(handle(fakeReq("sig"), fakeRes())).rejects.toThrow(BadRequestError);
  });

  it("starts the saga on payment_intent.succeeded", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id: "evt-1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1" } },
    } as never);
    const res = fakeRes();

    await handle(fakeReq("sig"), res);

    expect(membershipService.markChargedAndStartSaga).toHaveBeenCalledWith("evt-1", "pi_1");
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("marks the payment failed on payment_intent.payment_failed, with the decline reason", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id: "evt-1",
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_1", last_payment_error: { message: "card_declined" } } },
    } as never);

    await handle(fakeReq("sig"), fakeRes());

    expect(membershipService.markPaymentFailed).toHaveBeenCalledWith("evt-1", "pi_1", "card_declined");
  });

  it("acknowledges and ignores event types it doesn't handle", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id: "evt-1",
      type: "charge.refunded",
      data: { object: {} },
    } as never);
    const res = fakeRes();

    await handle(fakeReq("sig"), res);

    expect(membershipService.markChargedAndStartSaga).not.toHaveBeenCalled();
    expect(membershipService.markPaymentFailed).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
