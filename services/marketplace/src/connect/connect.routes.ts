import { Router } from "express";
import auth from "../middleware/auth";
import controller from "./connectController";

const router = Router();

router.use(auth);

// POST returns { url } — a fresh Stripe-hosted onboarding link, redirect the browser to it.
router.post("/onboard", controller.onboard);
// GET returns { connected, chargesEnabled, payoutsEnabled } — poll after Stripe redirects back.
router.get("/status", controller.status);

export default router;
