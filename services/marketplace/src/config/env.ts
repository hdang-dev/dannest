// Loads config once at startup — every other module reads from here instead of
// touching process.env directly. Unlike the old media service, DB/JWT/broker all have
// zero-config local defaults (matching Core/Notification's convention) — only Stripe
// is genuinely optional-but-required-for-payments, same pattern as Core's R2Config.
import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 8092,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/dannest_marketplace",
  jwtSecret:
    process.env.JWT_SECRET || "dev-only-insecure-jwt-secret-change-me-please-0123456789abcdef",
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .filter(Boolean),
  rabbitmqUrl: process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672/",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    connectRefreshUrl:
      process.env.STRIPE_CONNECT_REFRESH_URL || "http://localhost:3000/settings/payouts",
    connectReturnUrl:
      process.env.STRIPE_CONNECT_RETURN_URL || "http://localhost:3000/settings/payouts?connected=1",
  },
};

/** True once the API key is set — everything except the (not yet built) webhook endpoint
 * only needs this. webhookSecret is checked separately, once that endpoint exists. */
export const stripeConfigured = Boolean(env.stripe.secretKey);
