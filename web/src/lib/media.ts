// Client for the media API (/api/v1/media). A media asset is an uploaded image (R2)
// or an external link, and carries a display crop (fractions 0..1 of the image).

import { apiFetch } from "./api";

export type Crop = { x: number; y: number; width: number; height: number };

export type Media = {
  id: string;
  url: string;
  crop: Crop;
};

export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };

/** POST /api/v1/media — upload image bytes (the full, downscaled image) with a crop. */
export function uploadMedia(file: Blob, crop: Crop, filename = "cover.webp"): Promise<Media> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("cropX", String(crop.x));
  form.append("cropY", String(crop.y));
  form.append("cropWidth", String(crop.width));
  form.append("cropHeight", String(crop.height));
  return apiFetch<Media>(`/api/v1/media`, { method: "POST", body: form });
}

/** POST /api/v1/media/external — register an image link (no bytes stored) with a crop. */
export function createExternalMedia(url: string, crop: Crop): Promise<Media> {
  return apiFetch<Media>(`/api/v1/media/external`, {
    method: "POST",
    body: JSON.stringify({ url, crop }),
  });
}

/** PATCH /api/v1/media/{id} — update just the display crop. */
export function updateMediaCrop(id: string, crop: Crop): Promise<Media> {
  return apiFetch<Media>(`/api/v1/media/${id}`, {
    method: "PATCH",
    body: JSON.stringify(crop),
  });
}

/** DELETE /api/v1/media/{id}. */
export function deleteMedia(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/media/${id}`, { method: "DELETE" });
}
