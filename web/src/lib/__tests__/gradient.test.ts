import { describe, it, expect } from "vitest";
import { gradientFor } from "../gradient";

describe("gradientFor", () => {
  it("always returns the same gradient for the same id", () => {
    const id = "collection-123";
    expect(gradientFor(id)).toEqual(gradientFor(id));
  });

  it("returns a valid [start, end] color pair", () => {
    const [start, end] = gradientFor("some-id");
    expect(start).toMatch(/^#[0-9a-f]{6}$/i);
    expect(end).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("doesn't crash on an empty id", () => {
    expect(() => gradientFor("")).not.toThrow();
  });
});
