import { Request, Response } from "express";
import { BadRequestError } from "../errors";
import * as membershipService from "./membershipService";

async function initiate(req: Request, res: Response): Promise<void> {
  const { collectionId, priceCents } = req.body;
  const result = await membershipService.initiatePurchase({
    buyerId: req.userId,
    collectionId,
    priceCents,
  });
  // 201, not 202 — this creates a real resource (a PENDING_PAYMENT purchase +
  // PaymentIntent) synchronously. Nothing async has happened yet; that starts once
  // the browser confirms payment with the returned clientSecret.
  res.status(201).json(result);
}

async function get(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  // Express 5 types req.params values as string | string[] (repeated-segment routes
  // can produce arrays) — :id here is always a single segment, but assert it plainly.
  if (typeof id !== "string") throw new BadRequestError("Invalid purchase id");
  const purchase = await membershipService.getPurchase(id);
  res.json(purchase);
}

export default { initiate, get };
