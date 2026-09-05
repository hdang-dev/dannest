import InboxEvent from "./InboxEvent";

/**
 * Call this as the very first thing a saga reply handler does. Returns {@code true} the
 * first time this exact event is seen (go ahead and process it), {@code false} on a
 * redelivery (RabbitMQ's at-least-once guarantee means duplicates are routine, not a
 * bug — skip without erroring).
 */
export async function claim(eventId: string, consumer: string): Promise<boolean> {
  try {
    await InboxEvent.create({ eventId, consumer });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
