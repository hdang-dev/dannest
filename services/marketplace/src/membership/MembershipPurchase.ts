import { Document, Schema, model } from "mongoose";

export type MembershipPurchaseStatus = "CHARGED" | "CONFIRMED" | "REFUNDED";

export interface MembershipPurchaseDocument extends Document {
  buyerId: string;
  collectionId: string;
  priceCents: number;
  stripePaymentIntentId: string;
  stripeTransferId: string | null;
  status: MembershipPurchaseStatus;
  /** Why it was refunded — Core's rejection reason, or "settle_failed" (see membershipService). */
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const membershipPurchaseSchema = new Schema<MembershipPurchaseDocument>(
  {
    buyerId: { type: String, required: true, index: true },
    collectionId: { type: String, required: true, index: true },
    priceCents: { type: Number, required: true },
    stripePaymentIntentId: { type: String, required: true },
    stripeTransferId: { type: String, default: null },
    status: {
      type: String,
      enum: ["CHARGED", "CONFIRMED", "REFUNDED"],
      required: true,
      default: "CHARGED",
    },
    reason: { type: String, default: null },
  },
  { timestamps: true },
);

export default model<MembershipPurchaseDocument>("MembershipPurchase", membershipPurchaseSchema);
