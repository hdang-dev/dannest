// Small wrapper around Mongoose's session lifecycle — every atomic multi-document
// write in this service (purchase state + outbox event, purchase state + inbox
// claim) goes through here instead of repeating the startSession/endSession
// boilerplate at each call site.
import mongoose, { ClientSession } from "mongoose";

export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
