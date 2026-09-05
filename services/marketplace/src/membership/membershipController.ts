import { Request, Response } from "express";
import { BadRequestError } from "../errors";
import * as membershipService from "./membershipService";

async function initiate(req: Request, res: Response): Promise<void> {
  const { collectionId, priceCents, paymentMethodId } = req.body;
  const result = await membershipService.initiatePurchase({
    buyerId: req.userId,
    collectionId,
    priceCents,
    paymentMethodId,
  });
  res.status(202).json(result);
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
