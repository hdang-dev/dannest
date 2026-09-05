// Call this from inside the same Mongo transaction (ClientSession) as the business
// write it accompanies — both commit together or neither does. Mirrors Core's
// OutboxWriter exactly, just with a session param instead of riding an ambient
// @Transactional context (Mongoose has no such thing — the session must be threaded
// through explicitly).
import { ClientSession } from "mongoose";
import OutboxEvent from "./OutboxEvent";

export async function writeOutboxEvent(
  session: ClientSession,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await OutboxEvent.create([{ aggregateType, aggregateId, eventType, payload }], { session });
}
