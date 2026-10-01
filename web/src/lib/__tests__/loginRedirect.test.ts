import { describe, it, expect } from "vitest";
import { loginUrl, safeNext } from "../loginRedirect";

describe("safeNext", () => {
  it("keeps a same-site path, including its query", () => {
    expect(safeNext("/collections/abc?post=1")).toBe("/collections/abc?post=1");
  });

  it("falls back to home for missing, external, or protocol-relative targets", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
  });

  it("never sends you back to the login page itself", () => {
    expect(safeNext("/login")).toBe("/");
    expect(safeNext("/login?next=/x")).toBe("/");
  });
});

describe("loginUrl", () => {
  it("carries the page to return to", () => {
    expect(loginUrl("/collections/abc")).toBe("/login?next=%2Fcollections%2Fabc");
  });

  it("is plain /login when there's nowhere better than home to return to", () => {
    expect(loginUrl("/")).toBe("/login");
    expect(loginUrl("https://evil.example")).toBe("/login");
  });
});
