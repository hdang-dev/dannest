import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClientSession } from "mongoose";
import { writeOutboxEvent } from "../outbox.service";
import OutboxEvent from "../../models/OutboxEvent";

vi.mock("../../models/OutboxEvent", () => ({
  default: { create: vi.fn() },
}));

const fakeSession = {} as ClientSession;

describe("writeOutboxEvent", () => {
  beforeEach(() => {
    vi.mocked(OutboxEvent.create).mockReset();
  });

  it("saves the event with the given data, inside the given session", async () => {
    await writeOutboxEvent(fakeSession, "MEMBERSHIP_PURCHASE", "purchase-1", "marketplace.membership.charged", {
      foo: "bar",
    });

    expect(OutboxEvent.create).toHaveBeenCalledWith(
      [
        {
          aggregateType: "MEMBERSHIP_PURCHASE",
          aggregateId: "purchase-1",
          eventType: "marketplace.membership.charged",
          payload: { foo: "bar" },
        },
      ],
      { session: fakeSession },
    );
  });
});
