// Cloudflare R2 is S3-compatible — same credentials/bucket Core used pre-split,
// just accessed via the Node AWS SDK instead of the Java one.
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";

export const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.r2.accessKey,
    secretAccessKey: env.r2.secretKey,
  },
});

export const bucket = env.r2.bucket;
export const publicBaseUrl = env.r2.publicBaseUrl;
