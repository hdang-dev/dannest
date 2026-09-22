import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { claim } from "../inbox.service";
import InboxEvent from "../../models/InboxEvent";
import { withTransaction } from "../../db/transaction";
import { startMongoMemory, stopMongoMemory } from "../../test/mongoMemoryReplSet";

beforeAll(async () => {
  await startMongoMemory();
  await InboxEvent.init(); // wait for the unique index to finish building
});

afterAll(stopMongoMemory);

beforeEach(async () => {
  await InboxEvent.deleteMany({});
});

describe("claim (integration, real MongoDB)", () => {
  it("really does reject a duplicate event via the unique index", async () => {
    const first = await withTransaction((session) => claim(session, "evt-123", "marketplace.membership"));
    const second = await withTransaction((session) => claim(session, "evt-123", "marketplace.membership"));

    expect(first).toBe(true);
    expect(second).toBe(false);

    const count = await InboxEvent.countDocuments({ eventId: "evt-123" });
    expect(count).toBe(1);
  });
});
