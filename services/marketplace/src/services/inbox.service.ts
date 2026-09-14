import { ClientSession } from "mongoose";
import InboxEvent from "../models/InboxEvent";

/**
 * Call this INSIDE the same transaction as the write it's guarding — either the
 * handler's own state write (nothing fallible precedes it), or, for a handler that
 * first does something fallible (a Stripe transfer/refund, say), the final state
 * write after that fallible part has already succeeded. Either way, a mid-handler
 * failure leaves the event unclaimed (safe to retry or replay from the DLQ) instead
 * of permanently swallowed.
 *
 * Returns {@code true} the first time this exact event is seen (go ahead and process
 * it), {@code false} on a redelivery (RabbitMQ and Stripe both redeliver at least
 * once as a matter of course, not just on real failures — skip without erroring).
 */
export async function claim(
  session: ClientSession,
  eventId: string,
  consumer: string,
): Promise<boolean> {
  try {
    await InboxEvent.create([{ eventId, consumer }], { session });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
