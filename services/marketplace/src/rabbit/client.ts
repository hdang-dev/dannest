// Connects to the same `dannest.events` topic exchange Core declared. Types are kept
// loose (not the exact amqplib version's exported names, which have shifted between
// releases — e.g. the connection type was renamed to ChannelModel in 0.10.x) since only
// this module ever touches the raw amqplib API; everything else uses publish()/consume().
import amqp, { Channel } from "amqplib";
import { env } from "../config/env";

export const EVENTS_EXCHANGE = "dannest.events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connection: any = null;
let channel: Channel | null = null;

export async function connect(): Promise<void> {
  connection = await amqp.connect(env.rabbitmqUrl);
  channel = await connection.createChannel();
  await channel!.assertExchange(EVENTS_EXCHANGE, "topic", { durable: true });
  console.log("Connected to RabbitMQ");
}

export function getChannel(): Channel {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized — call rabbit/client.connect() first");
  }
  return channel;
}
