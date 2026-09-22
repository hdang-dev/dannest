import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishPending } from "../outboxPoller.service";
import OutboxEvent from "../../models/OutboxEvent";
import { getChannel } from "../../messaging/rabbit.client";

vi.mock("../../models/OutboxEvent", () => ({
  default: { find: vi.fn() },
}));
vi.mock("../../messaging/rabbit.client", () => ({
  EVENTS_EXCHANGE: "dannest.events",
  getChannel: vi.fn(),
}));

function fakeQuery(events: unknown[]) {
  return { sort: () => ({ limit: () => Promise.resolve(events) }) };
}

beforeEach(() => {
  vi.mocked(OutboxEvent.find).mockReset();
  vi.mocked(getChannel).mockReset();
});

describe("publishPending", () => {
  it("does nothing when there are no unpublished events", async () => {
    vi.mocked(OutboxEvent.find).mockReturnValue(fakeQuery([]) as never);

    await publishPending();

    expect(getChannel).not.toHaveBeenCalled();
  });

  it("publishes each pending event and marks it published", async () => {
    const publish = vi.fn();
    vi.mocked(getChannel).mockReturnValue({ publish } as never);
    const event = {
      id: "evt-1",
      eventType: "marketplace.membership.charged",
      payload: { a: 1 },
      publishedAt: null as Date | null,
      save: vi.fn(),
    };
    vi.mocked(OutboxEvent.find).mockReturnValue(fakeQuery([event]) as never);

    await publishPending();

    expect(publish).toHaveBeenCalledWith(
      "dannest.events",
      "marketplace.membership.charged",
      expect.any(Buffer),
      { contentType: "application/json" },
    );
    expect(event.publishedAt).toBeInstanceOf(Date);
    expect(event.save).toHaveBeenCalled();
  });

  it("records the failure and keeps the event unpublished if the channel throws", async () => {
    const publish = vi.fn(() => {
      throw new Error("channel closed");
    });
    vi.mocked(getChannel).mockReturnValue({ publish } as never);
    const event = {
      id: "evt-1",
      eventType: "marketplace.membership.charged",
      payload: {},
      attempts: 0,
      lastError: null as string | null,
      publishedAt: null as Date | null,
      save: vi.fn(),
    };
    vi.mocked(OutboxEvent.find).mockReturnValue(fakeQuery([event]) as never);

    await publishPending();

    expect(event.publishedAt).toBeNull();
    expect(event.attempts).toBe(1);
    expect(event.lastError).toBe("channel closed");
    expect(event.save).toHaveBeenCalled();
  });
});
