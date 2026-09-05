// Stripe calls this directly — no JWT, no JSON body (Stripe signs the raw bytes
// itself). Mounted in app.ts with express.raw(), before express.json() and before
// any auth middleware. This is the moment a real payment turns into the saga's
// first step — see membershipService.markChargedAndStartSaga.
import { Request, Response } from "express";
import Stripe from "stripe";
import { env } from "../config/env";
import { stripe } from "../stripe/client";
import { BadRequestError } from "../errors";
import * as membershipService from "./membershipService";

export async function handle(req: Request, res: Response): Promise<void> {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || !env.stripe.webhookSecret) {
    throw new BadRequestError("Missing Stripe signature or webhook not configured");
  }

  let event: Stripe.Event;
  try {
    // req.body is a raw Buffer here (see the express.raw() mount in app.ts) —
    // constructEvent needs the exact original bytes to verify the signature; a
    // JSON-parsed-and-restringified body would not match.
    event = stripe.webhooks.constructEvent(req.body, signature, env.stripe.webhookSecret);
  } catch (err) {
    throw new BadRequestError(`Webhook signature verification failed: ${(err as Error).message}`);
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await membershipService.markChargedAndStartSaga(event.id, intent.id);
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const reason = intent.last_payment_error?.message ?? null;
      await membershipService.markPaymentFailed(event.id, intent.id, reason);
      break;
    }
    default:
      // Anything else we didn't ask for — ack it and move on, nothing to do.
      break;
  }

  res.json({ received: true });
}
