// Renders a cover image with its stored crop applied purely in CSS — no re-encoding,
// no CORS needed (works for uploaded and external images alike).
//
// The crop is a rectangle (fractions 0..1) of the image, constrained at crop time to
// the cover aspect ratio, so containers using that same ratio show it without distortion.

import type { CSSProperties } from "react";
import type { Crop } from "./media";

/** Every place a cover is shown uses this aspect (matches the cropper). */
export const COVER_ASPECT = "16 / 10";

export function coverStyle(url: string | null, crop?: Crop | null): CSSProperties {
  if (!url) return {};
  const bg: CSSProperties = {
    backgroundImage: `url("${url}")`,
    backgroundRepeat: "no-repeat",
  };
  // Full image (or no crop) → plain cover/center.
  if (!crop || (crop.width >= 0.999 && crop.height >= 0.999)) {
    return { ...bg, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const sizeX = 100 / crop.width;
  const sizeY = 100 / crop.height;
  const posX = crop.width < 1 ? (crop.x / (1 - crop.width)) * 100 : 0;
  const posY = crop.height < 1 ? (crop.y / (1 - crop.height)) * 100 : 0;
  return {
    ...bg,
    backgroundSize: `${sizeX}% ${sizeY}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  };
}
