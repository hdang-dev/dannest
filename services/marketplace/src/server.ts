import app from "./app";
import { connect as connectMongo } from "./db/mongoose";
import { connect as connectRabbit } from "./messaging/rabbit.client";
import { startOutboxPoller } from "./services/outboxPoller.service";
import { startMembershipReplyListener } from "./messaging/membershipReplyListener";
import { env } from "./config/env";

async function start(): Promise<void> {
  await connectMongo();
  await connectRabbit();
  startOutboxPoller();
  await startMembershipReplyListener();
  app.listen(env.port, () => console.log(`dannest-marketplace listening on ${env.port}`));
}

start().catch((err) => {
  console.error("Failed to start dannest-marketplace", err);
  process.exit(1);
});
