// Loads and validates environment config once at startup — every other module
// reads from here instead of touching process.env directly.
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 8092,
  mongoUri: required("MONGO_URI"),
  jwtSecret: required("JWT_SECRET"),
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || "").split(",").filter(Boolean),
  r2: {
    accountId: required("R2_ACCOUNT_ID"),
    accessKey: required("R2_ACCESS_KEY"),
    secretKey: required("R2_SECRET_KEY"),
    bucket: required("R2_BUCKET"),
    publicBaseUrl: required("R2_PUBLIC_BASE_URL"),
  },
};
