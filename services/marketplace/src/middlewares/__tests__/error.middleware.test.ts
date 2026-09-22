import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import errorHandler from "../error.middleware";
import { NotFoundError } from "../../errors";

function fakeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe("error middleware", () => {
  it("uses the error's own status and message for a known HttpError", () => {
    const res = fakeRes();

    errorHandler(new NotFoundError("Purchase not found"), {} as Request, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Purchase not found" });
  });

  it("falls back to a generic 500 for anything else", () => {
    const res = fakeRes();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("unexpected"), {} as Request, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
    spy.mockRestore();
  });
});
