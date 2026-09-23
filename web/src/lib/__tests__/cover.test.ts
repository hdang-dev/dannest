import { describe, it, expect } from "vitest";
import { coverStyle, croppedCoverStyle } from "../cover";

describe("coverStyle", () => {
  it("returns nothing for a missing url", () => {
    expect(coverStyle(null)).toEqual({});
  });

  it("centers and covers when there's no crop", () => {
    const style = coverStyle("https://x/img.jpg");
    expect(style.backgroundSize).toBe("cover");
    expect(style.backgroundPosition).toBe("center");
  });

  it("centers and covers when the crop is (near enough) the full image", () => {
    const style = coverStyle("https://x/img.jpg", { x: 0, y: 0, width: 1, height: 1 });
    expect(style.backgroundSize).toBe("cover");
  });

  it("zooms and offsets to the crop rectangle for a partial crop", () => {
    const style = coverStyle("https://x/img.jpg", { x: 0.25, y: 0, width: 0.5, height: 0.5 });
    expect(style.backgroundSize).toBe("200% 200%");
    expect(style.backgroundPosition).toBe("50% 0%");
  });
});

describe("croppedCoverStyle", () => {
  it("returns nothing for a missing url", () => {
    expect(croppedCoverStyle(null, null, 1)).toEqual({});
  });

  it("falls back to a plain cover when there's no crop", () => {
    const style = croppedCoverStyle("https://x/img.jpg", null, 1);
    expect(style.backgroundSize).toBe("cover");
  });

  it("frames by width when the tile is wider than the crop's own aspect", () => {
    const crop = { x: 0, y: 0.25, width: 1, height: 0.5 };
    const style = croppedCoverStyle("https://x/img.jpg", crop, 2, 1);
    expect(style.backgroundSize).toBe("100% auto");
  });

  it("frames by height when the tile is taller than the crop's own aspect", () => {
    const crop = { x: 0.25, y: 0, width: 0.5, height: 1 };
    const style = croppedCoverStyle("https://x/img.jpg", crop, 0.5, 1);
    expect(style.backgroundSize).toBe("auto 100%");
  });
});
