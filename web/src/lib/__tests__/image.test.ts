import { describe, it, expect } from "vitest";
import { normalizeImageUrl } from "../image";

describe("normalizeImageUrl", () => {
  it("rewrites a Google Drive share link to the embeddable CDN URL", () => {
    const result = normalizeImageUrl("https://drive.google.com/file/d/ABC123/view?usp=sharing");

    expect(result).toEqual({ url: "https://lh3.googleusercontent.com/d/ABC123", reformatted: true });
  });

  it("leaves a non-Drive URL unchanged", () => {
    const result = normalizeImageUrl("https://example.com/photo.jpg");

    expect(result).toEqual({ url: "https://example.com/photo.jpg", reformatted: false });
  });

  it("leaves an already-direct Drive CDN URL unchanged", () => {
    const url = "https://lh3.googleusercontent.com/d/ABC123";

    expect(normalizeImageUrl(url)).toEqual({ url, reformatted: false });
  });
});
