// Port of Core's old MediaService.java. Per the spec, this service does no image
// processing — it only validates the file, stores the bytes, records the asset,
// and returns its id + url. Cropping/zooming/resizing stays client-side.
import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import Media, { MediaDocument } from "../models/Media";
import { bucket, publicBaseUrl, s3 } from "./r2Client";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors";
import { Crop, FULL_CROP, MediaResponse } from "../types";

const ALLOWED_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function toResponse(media: MediaDocument): MediaResponse {
  return {
    id: media.id as string,
    url: media.url,
    crop: media.crop,
  };
}

async function upload(userId: string, file: Express.Multer.File | undefined, crop?: Crop): Promise<MediaResponse> {
  if (!file || !file.buffer || file.size === 0) {
    throw new BadRequestError("No file provided");
  }
  const extension = ALLOWED_TYPES[file.mimetype];
  if (!extension) {
    throw new BadRequestError(`Unsupported image type: ${file.mimetype}`);
  }

  // The client filename is untrusted — build our own key, namespaced by user.
  const key = `users/${userId}/${randomUUID()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  const media = await Media.create({
    ownerId: userId,
    source: "UPLOAD",
    storageKey: key,
    url: `${publicBaseUrl}/${key}`,
    mimeType: file.mimetype,
    size: file.size,
    crop: crop ?? FULL_CROP,
  });
  return toResponse(media);
}

async function createExternal(userId: string, url: string | undefined, crop?: Crop): Promise<MediaResponse> {
  if (!url || !url.trim()) {
    throw new BadRequestError("No URL provided");
  }
  const media = await Media.create({
    ownerId: userId,
    source: "EXTERNAL",
    url: url.trim(),
    crop: crop ?? FULL_CROP,
  });
  return toResponse(media);
}

async function findOwned(userId: string, mediaId: string): Promise<MediaDocument> {
  const media = await Media.findOne({ _id: mediaId, deletedAt: null });
  if (!media) throw new NotFoundError(`Media not found: ${mediaId}`);
  if (media.ownerId !== userId) throw new ForbiddenError("You do not own this media");
  return media;
}

async function updateCrop(userId: string, mediaId: string, crop: Crop): Promise<MediaResponse> {
  const media = await findOwned(userId, mediaId);
  media.crop = crop;
  await media.save();
  return toResponse(media);
}

/** Soft-delete — the row (and its url) keeps resolving for anything that already
 * copied it, but bytes are freed in R2 for uploads. See docs/tech/db-schema.md's
 * media-split notes for why deletion never cascades into other services. */
async function remove(userId: string, mediaId: string): Promise<void> {
  const media = await findOwned(userId, mediaId);
  if (media.source === "UPLOAD" && media.storageKey) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.storageKey }));
  }
  media.deletedAt = new Date();
  await media.save();
}

export default { upload, createExternal, updateCrop, remove, toResponse };
