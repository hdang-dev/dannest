import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConsumeMessage } from "amqplib";
import { consume } from "../consume";
import { getChannel } from "../rabbit.client";

vi.mock("../rabbit.client", () => ({
  EVENTS_EXCHANGE: "dannest.events",
  getChannel: vi.fn(),
}));

function fakeChannel() {
  let onMessage: ((msg: ConsumeMessage | null) => void) | undefined;
  return {
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    consume: vi.fn((_queue: string, cb: typeof onMessage) => {
      onMessage = cb;
    }),
    ack: vi.fn(),
    nack: vi.fn(),
    deliver: (msg: ConsumeMessage | null) => onMessage?.(msg),
  };
}

const fakeMsg = { content: Buffer.from("{}"), fields: { routingKey: "some.key" } } as ConsumeMessage;

beforeEach(() => {
  vi.mocked(getChannel).mockReset();
});

describe("consume", () => {
  it("declares the queue with its dead-letter queue, and binds every routing key", async () => {
    const channel = fakeChannel();
    vi.mocked(getChannel).mockReturnValue(channel as never);

    await consume({
      queue: "q",
      deadLetterQueue: "q.dlq",
      bindingKeys: ["a", "b"],
      handler: vi.fn(),
    });

    expect(channel.assertQueue).toHaveBeenCalledWith("q.dlq", { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith(
      "q",
      expect.objectContaining({ deadLetterRoutingKey: "q.dlq" }),
    );
    expect(channel.bindQueue).toHaveBeenCalledWith("q", "dannest.events", "a");
    expect(channel.bindQueue).toHaveBeenCalledWith("q", "dannest.events", "b");
  });

  it("acks the message once the handler succeeds", async () => {
    const channel = fakeChannel();
    vi.mocked(getChannel).mockReturnValue(channel as never);
    const handler = vi.fn().mockResolvedValue(undefined);

    await consume({ queue: "q", deadLetterQueue: "q.dlq", bindingKeys: [], handler });
    channel.deliver(fakeMsg);
    await vi.waitFor(() => expect(channel.ack).toHaveBeenCalledWith(fakeMsg));
  });

  it("sends the message straight to the DLQ (no requeue) when the handler throws", async () => {
    const channel = fakeChannel();
    vi.mocked(getChannel).mockReturnValue(channel as never);
    const handler = vi.fn().mockRejectedValue(new Error("boom"));

    await consume({ queue: "q", deadLetterQueue: "q.dlq", bindingKeys: [], handler });
    channel.deliver(fakeMsg);
    await vi.waitFor(() => expect(channel.nack).toHaveBeenCalledWith(fakeMsg, false, false));
  });
});
