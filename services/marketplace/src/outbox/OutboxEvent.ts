// Mongo's mirror of Core's outbox_event table (see V11__outbox_inbox.sql) — same
// mechanism, adapted to a document store: payload is stored as a native object here
// rather than pre-serialized text, since Mongo has no reason to make you pre-stringify
// it the way a relational column would.
import { Document, Schema, model } from "mongoose";

export interface OutboxEventDocument extends Document {
  aggregateType: string;
  aggregateId: string;
  /** Also the RabbitMQ routing key on dannest.events. */
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  publishedAt: Date | null;
  attempts: number;
  lastError: string | null;
}

const outboxEventSchema = new Schema<OutboxEventDocument>({
  aggregateType: { type: String, required: true },
  aggregateId: { type: String, required: true },
  eventType: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
  publishedAt: { type: Date, default: null },
  attempts: { type: Number, required: true, default: 0 },
  lastError: { type: String, default: null },
});

// The poller's only query shape: unpublished rows, oldest first.
outboxEventSchema.index(
  { createdAt: 1 },
  { partialFilterExpression: { publishedAt: null } },
);

export default model<OutboxEventDocument>("OutboxEvent", outboxEventSchema);
