import { Request, Response } from "express";
import * as connectService from "./connectService";

// No try/catch: Express 5 forwards a rejected promise from an async handler straight
// to errorHandler on its own — see app.ts's comment on why we're on 5, not 4.

async function onboard(req: Request, res: Response): Promise<void> {
  const result = await connectService.onboard(req.userId);
  res.json(result);
}

async function status(req: Request, res: Response): Promise<void> {
  const result = await connectService.getStatus(req.userId);
  res.json(result);
}

export default { onboard, status };
