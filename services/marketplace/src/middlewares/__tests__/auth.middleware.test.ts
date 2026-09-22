import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import auth from "../auth.middleware";
import { env } from "../../config/env";
import { UnauthorizedError } from "../../errors";

function fakeReq(header?: string): Request {
  return { headers: header ? { authorization: header } : {} } as Request;
}

describe("auth middleware", () => {
  it("attaches userId and calls next() for a valid token", () => {
    const token = jwt.sign({ sub: "user-1" }, env.jwtSecret);
    const req = fakeReq(`Bearer ${token}`);
    const next = vi.fn();

    auth(req, {} as Response, next);

    expect(req.userId).toBe("user-1");
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a missing Authorization header", () => {
    const next = vi.fn();

    auth(fakeReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("rejects a non-Bearer scheme", () => {
    const next = vi.fn();

    auth(fakeReq("Basic abc123"), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("rejects an invalid/expired token", () => {
    const next = vi.fn();

    auth(fakeReq("Bearer not-a-real-token"), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("rejects a token with no subject", () => {
    const token = jwt.sign({ notSub: "x" }, env.jwtSecret);
    const next = vi.fn();

    auth(fakeReq(`Bearer ${token}`), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
