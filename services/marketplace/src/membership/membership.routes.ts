import { Router } from "express";
import auth from "../middleware/auth";
import controller from "./membershipController";

const router = Router();

router.use(auth);

// 202: the saga is only starting here, not finished — poll GET /:id for CONFIRMED/REFUNDED.
router.post("/", controller.initiate);
router.get("/:id", controller.get);

export default router;
