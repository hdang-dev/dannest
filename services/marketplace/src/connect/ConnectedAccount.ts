// A creator's Stripe Express account — the destination for their cut of a membership
// sale (see membership/ once the saga exists). One per user; created lazily the first
// time they start onboarding. chargesEnabled/payoutsEnabled are a cache of Stripe's own
// account status, refreshed whenever we check it — never the source of truth.
import { Document, Schema, model } from "mongoose";

export interface ConnectedAccountDocument extends Document {
  userId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const connectedAccountSchema = new Schema<ConnectedAccountDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    stripeAccountId: { type: String, required: true },
    chargesEnabled: { type: Boolean, required: true, default: false },
    payoutsEnabled: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

export default model<ConnectedAccountDocument>("ConnectedAccount", connectedAccountSchema);
