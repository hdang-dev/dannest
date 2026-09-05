import { ClientSession } from "mongoose";
import InboxEvent from "./InboxEvent";

/**
 * Call this as the very first thing a handler does IF nothing it's about to do can
 * fail (no external API calls, no fallible I/O) — e.g. guarding against a Stripe
 * webhook redelivery before doing anything else. If the handler's own work can throw
 * partway through, use {@link claimInTransaction} instead: claiming here first and
 * then failing would mark the event "done" forever with the real effect never having
 * happened, silently defeating the DLQ's whole purpose as a by-hand retry point.
 *
 * Returns {@code true} the first time this exact event is seen (go ahead and process
 * it), {@code false} on a redelivery (RabbitMQ and Stripe both redeliver at least
 * once as a matter of course, not just on real failures — skip without erroring).
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

/**
 * Same idea as {@link claim}, but for a handler that first does something fallible
 * (a Stripe transfer/refund, say) and only afterwards commits local state. Call this
 * INSIDE the same transaction as that final state write, after the fallible part has
 * already succeeded — so a mid-handler failure leaves the event unclaimed (safe to
 * retry or replay from the DLQ) instead of permanently swallowed.
 */
export async function claimInTransaction(
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
