import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConsumeMessage } from "amqplib";
import { startMembershipReplyListener } from "../membershipReplyListener";
import { consume } from "../consume";
import * as membershipService from "../../services/membership.service";

vi.mock("../consume", () => ({ consume: vi.fn() }));
vi.mock("../../services/membership.service", () => ({
  handleActivated: vi.fn(),
  handleRejected: vi.fn(),
}));

function messageWith(routingKey: string, payload: unknown): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: { routingKey },
  } as ConsumeMessage;
}

beforeEach(() => {
  vi.mocked(consume).mockReset();
  vi.mocked(membershipService.handleActivated).mockReset();
  vi.mocked(membershipService.handleRejected).mockReset();
});

describe("startMembershipReplyListener", () => {
  it("routes core.membership.granted to handleActivated", async () => {
    await startMembershipReplyListener();
    const handler = vi.mocked(consume).mock.calls[0][0].handler;

    const payload = { eventId: "evt-1", purchaseId: "purchase-1", ownerId: "owner-1" };
    await handler(messageWith("core.membership.granted", payload));

    expect(membershipService.handleActivated).toHaveBeenCalledWith(payload);
  });

  it("routes core.membership.rejected to handleRejected", async () => {
    await startMembershipReplyListener();
    const handler = vi.mocked(consume).mock.calls[0][0].handler;

    const payload = { eventId: "evt-1", purchaseId: "purchase-1", reason: "policy" };
    await handler(messageWith("core.membership.rejected", payload));

    expect(membershipService.handleRejected).toHaveBeenCalledWith(payload);
  });

  it("throws on an unexpected routing key instead of silently ignoring it", async () => {
    await startMembershipReplyListener();
    const handler = vi.mocked(consume).mock.calls[0][0].handler;

    await expect(handler(messageWith("something.else", {}))).rejects.toThrow(
      /Unexpected routing key/,
    );
  });
});
