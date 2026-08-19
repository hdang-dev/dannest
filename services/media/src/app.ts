import express from "express";
import cors from "cors";
import { env } from "./config/env";
import mediaRoutes from "./routes/media.routes";
import errorHandler from "./middleware/errorHandler";

const app = express();

app.use(cors({ origin: env.corsAllowedOrigins, credentials: true }));
app.use(express.json());

// Matches Core's /actuator/health and Notification's — Render polls this.
app.get("/healthz", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1/media", mediaRoutes);

app.use(errorHandler);

export default app;
