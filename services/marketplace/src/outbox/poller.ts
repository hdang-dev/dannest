// Publishes OutboxEvent rows RabbitMQ hasn't seen yet, oldest first. A failed publish
// just leaves publishedAt null — picked up again next tick. Single instance (like every
// other service in this project), so a plain find+loop is fine — no atomic claim/lock
// needed the way a multi-instance poller would require.
import { EVENTS_EXCHANGE, getChannel } from "../rabbit/client";
import OutboxEvent from "./OutboxEvent";

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 100;

export function startOutboxPoller(): void {
  setInterval(() => {
    publishPending().catch((err) => console.error("Outbox poller tick failed:", err));
  }, POLL_INTERVAL_MS);
}

async function publishPending(): Promise<void> {
  const batch = await OutboxEvent.find({ publishedAt: null }).sort({ createdAt: 1 }).limit(BATCH_SIZE);
  if (batch.length === 0) return;

  const channel = getChannel();
  for (const event of batch) {
    try {
      const body = Buffer.from(JSON.stringify(event.payload));
      channel.publish(EVENTS_EXCHANGE, event.eventType, body, { contentType: "application/json" });
      event.publishedAt = new Date();
    } catch (err) {
      event.attempts += 1;
      event.lastError = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to publish outbox event ${event.id} (${event.eventType}):`, err);
    }
    await event.save();
  }
}
