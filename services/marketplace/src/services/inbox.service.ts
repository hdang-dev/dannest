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
 *
 * The duplicate-key write above always runs inside a transaction (every call site
 * goes through db/transaction.ts's withTransaction()). MongoDB aborts a transaction
 * server-side the instant ANY write inside it fails — catching the error here does
 * NOT undo that, so we must abort the session ourselves before returning false.
 * Skipping this step leaves the session in a dead-but-still-"active" state: the
 * driver's withTransaction() then tries to commit it, the commit fails, it retries
 * the whole callback (hitting the same duplicate key again), and repeats until its
 * internal ~120s retry budget is exhausted — turning a routine redelivery into a
 * multi-minute hang. Calling abortTransaction() ourselves tells withTransaction()
 * the transaction already ended, so it skips the commit/retry entirely.
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
    if (isDuplicateKeyError(err)) {
      await session.abortTransaction();
      return false;
    }
    throw err;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
