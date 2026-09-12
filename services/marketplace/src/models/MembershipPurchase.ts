import { Document, Schema, model } from "mongoose";

export type MembershipPurchaseStatus =
  | "PENDING_PAYMENT" // PaymentIntent created, buyer hasn't paid (or Stripe hasn't confirmed) yet
  | "PAYMENT_FAILED" // the card was declined etc. — nothing was ever charged, saga never started
  | "CHARGED" // webhook confirmed payment succeeded — saga's first step, purchase_initiated is queued
  | "CONFIRMED" // Core granted + the creator's cut was transferred
  | "REFUNDED"; // Core rejected, or the transfer to the creator failed — buyer's money went back

export interface MembershipPurchaseDocument extends Document {
  buyerId: string;
  collectionId: string;
  priceCents: number;
  stripePaymentIntentId: string;
  stripeTransferId: string | null;
  status: MembershipPurchaseStatus;
  /** Why it was refunded/failed — Core's rejection reason, "settle_failed", or Stripe's decline reason. */
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
      enum: ["PENDING_PAYMENT", "PAYMENT_FAILED", "CHARGED", "CONFIRMED", "REFUNDED"],
      required: true,
      default: "PENDING_PAYMENT",
    },
    reason: { type: String, default: null },
  },
  { timestamps: true },
);

export default model<MembershipPurchaseDocument>("MembershipPurchase", membershipPurchaseSchema);
