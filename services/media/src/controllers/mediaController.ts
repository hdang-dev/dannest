import { NextFunction, Request, Response } from "express";
import mediaService from "../services/mediaService";
import { Crop } from "../types";

function parseCrop(body: Record<string, unknown> | undefined): Crop | undefined {
  if (!body) return undefined;
  const { x, y, width, height } = body;
  if ([x, y, width, height].some((v) => v === undefined)) return undefined;
  return { x: Number(x), y: Number(y), width: Number(width), height: Number(height) };
}

async function upload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const crop = parseCrop({
      x: req.body.cropX ?? 0,
      y: req.body.cropY ?? 0,
      width: req.body.cropWidth ?? 1,
      height: req.body.cropHeight ?? 1,
    });
    const result = await mediaService.upload(req.userId, req.file, crop);
    res.status(201).location(`/api/v1/media/${result.id}`).json(result);
  } catch (err) {
    next(err);
  }
}

async function external(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const crop = parseCrop(req.body.crop);
    const result = await mediaService.createExternal(req.userId, req.body.url, crop);
    res.status(201).location(`/api/v1/media/${result.id}`).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateCrop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const crop = parseCrop(req.body);
    if (!crop) throw new Error("Invalid crop payload");
    const result = await mediaService.updateCrop(req.userId, req.params.id, crop);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await mediaService.remove(req.userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export default { upload, external, updateCrop, remove };
