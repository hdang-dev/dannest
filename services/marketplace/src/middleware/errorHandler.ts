import { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors";

export default function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
