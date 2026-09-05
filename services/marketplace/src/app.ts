import express from "express";
import cors from "cors";
import { env, stripeConfigured } from "./config/env";
import errorHandler from "./middleware/errorHandler";
import connectRoutes from "./connect/connect.routes";

const app = express();

app.use(cors({ origin: env.corsAllowedOrigins, credentials: true }));

// NOTE for phase 2 (Stripe webhook): mount that route with express.raw({type:
// "application/json"}) BEFORE this express.json(), and outside any router that
// applies the `auth` middleware — Stripe signs the raw body itself instead of
// sending a bearer token, so it needs both an unparsed body and no JWT check.
app.use(express.json());

// Matches Core's /actuator/health and Notification's — Render polls this.
app.get("/healthz", (req, res) => res.json({ status: "ok" }));

// On Express 5, not 4: a rejected promise from an async route handler is forwarded to
// errorHandler automatically. Controllers never need try/catch + next(err) themselves.
app.use("/api/v1/marketplace/connect", connectRoutes);

if (!stripeConfigured) {
  // Don't fail startup — only payment endpoints need Stripe. Warn loudly instead,
  // same as Core's R2Config does for unconfigured Cloudflare R2 credentials.
  console.warn(
    "Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are blank). " +
      "The app will run, but payment endpoints will fail until they are set.",
  );
}

app.use(errorHandler);

export default app;
