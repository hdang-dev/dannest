// Mongo equivalent of Core's old `media` table (see docs/tech/db-schema.md).
// Ownership, storage bookkeeping, and crop framing all live here — this service
// is the sole source of truth for an asset's url/crop. Consuming services (Core)
// only ever hold this document's _id plus a denormalized url/crop snapshot taken
// at write time — never a live reference back into this collection.
import { Document, Schema, model } from "mongoose";
import { Crop } from "../types";

export type MediaSource = "UPLOAD" | "EXTERNAL";

export interface MediaDocument extends Document {
  ownerId: string;
  source: MediaSource;
  storageKey: string | null;
  url: string;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  crop: Crop;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const cropSchema = new Schema<Crop>(
  {
    x: { type: Number, required: true, default: 0 },
    y: { type: Number, required: true, default: 0 },
    width: { type: Number, required: true, default: 1 },
    height: { type: Number, required: true, default: 1 },
  },
  { _id: false },
);

const mediaSchema = new Schema<MediaDocument>(
  {
    ownerId: { type: String, required: true, index: true },
    source: { type: String, enum: ["UPLOAD", "EXTERNAL"], required: true, default: "UPLOAD" },
    storageKey: { type: String, default: null },
    url: { type: String, required: true },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    crop: { type: cropSchema, required: true, default: () => ({ x: 0, y: 0, width: 1, height: 1 }) },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default model<MediaDocument>("Media", mediaSchema);
