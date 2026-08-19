import { Router } from "express";
import multer from "multer";
import auth from "../middleware/auth";
import controller from "../controllers/mediaController";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

router.use(auth);

router.post("/", upload.single("file"), controller.upload);
router.post("/external", controller.external);
router.patch("/:id", controller.updateCrop);
router.delete("/:id", controller.remove);

export default router;
