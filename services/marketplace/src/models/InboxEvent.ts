// Mongo's mirror of Core's inbox_event table — "have we already processed this event",
// one document per (event, consumer).
import { Document, Schema, model } from "mongoose";

export interface InboxEventDocument extends Document {
  eventId: string;
  consumer: string;
  receivedAt: Date;
}

const inboxEventSchema = new Schema<InboxEventDocument>({
  eventId: { type: String, required: true },
  consumer: { type: String, required: true },
  receivedAt: { type: Date, required: true, default: () => new Date() },
});

inboxEventSchema.index({ eventId: 1, consumer: 1 }, { unique: true });

export default model<InboxEventDocument>("InboxEvent", inboxEventSchema);
