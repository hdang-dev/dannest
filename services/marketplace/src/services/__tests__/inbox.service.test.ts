import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClientSession } from "mongoose";
import { claim } from "../inbox.service";
import InboxEvent from "../../models/InboxEvent";

// claim() only calls InboxEvent.create() — fake just that one method so this test
// never touches a real database. We don't care what a "session" actually is here,
// only that claim() passes it through.
vi.mock("../../models/InboxEvent", () => ({
  default: { create: vi.fn() },
}));

const fakeSession = { abortTransaction: vi.fn() } as unknown as ClientSession;

describe("claim", () => {
  beforeEach(() => {
    vi.mocked(InboxEvent.create).mockReset();
    vi.mocked(fakeSession.abortTransaction).mockReset();
  });

  it("returns true the first time an event is seen, and records it", async () => {
    vi.mocked(InboxEvent.create).mockResolvedValueOnce([{} as never]);

    const result = await claim(fakeSession, "evt-123", "marketplace.membership");

    expect(result).toBe(true);
    expect(InboxEvent.create).toHaveBeenCalledWith(
      [{ eventId: "evt-123", consumer: "marketplace.membership" }],
      { session: fakeSession },
    );
  });

  it("returns false on a redelivery of an already-claimed event", async () => {
    // Mongo's real error shape for a unique-index violation: an Error with code 11000.
    const duplicateKeyError = Object.assign(new Error("E11000 duplicate key error"), {
      code: 11000,
    });
    vi.mocked(InboxEvent.create).mockRejectedValueOnce(duplicateKeyError);

    const result = await claim(fakeSession, "evt-123", "marketplace.membership");

    expect(result).toBe(false);
    // The transaction is already dead server-side after this failure — we must
    // abort it ourselves, or withTransaction() will hang retrying a doomed commit.
    expect(fakeSession.abortTransaction).toHaveBeenCalledOnce();
  });

  it("does not swallow unrelated errors", async () => {
    const connectionError = Object.assign(new Error("connection lost"), { code: 9001 });
    vi.mocked(InboxEvent.create).mockRejectedValueOnce(connectionError);

    await expect(claim(fakeSession, "evt-123", "marketplace.membership")).rejects.toThrow(
      "connection lost",
    );
  });
});
