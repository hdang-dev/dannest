// Shared setup for integration tests that need a real (temporary, in-memory) MongoDB.
// A replica set, not a plain standalone server, because this service's transactions
// require one.
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let mongo: MongoMemoryReplSet;

export async function startMongoMemory(): Promise<void> {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
}

export async function stopMongoMemory(): Promise<void> {
  await mongoose.disconnect();
  await mongo.stop();
}
