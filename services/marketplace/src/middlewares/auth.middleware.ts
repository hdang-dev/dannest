// Verifies the same HS256 JWT Core issues (JWT_SECRET must match Core's exactly).
// The token's `sub` claim is the user's UUID — same convention Core's controllers use.
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export default function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new UnauthorizedError("Missing bearer token"));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub) throw new Error("Token has no subject");
    req.userId = payload.sub;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}
