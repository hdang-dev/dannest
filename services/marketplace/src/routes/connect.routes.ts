import { Router } from "express";
import auth from "../middlewares/auth.middleware";
import controller from "../controllers/connect.controller";

const router = Router();

router.use(auth);

// POST returns { url } — a fresh Stripe-hosted onboarding link, redirect the browser to it.
router.post("/onboard", controller.onboard);
// GET returns { connected, chargesEnabled, payoutsEnabled } — poll after Stripe redirects back.
router.get("/status", controller.status);

export default router;
