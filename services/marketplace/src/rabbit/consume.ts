// A queue + its dead-letter queue + bindings, declared together — every saga consumer
// in this service goes through here so none of them can accidentally end up wildcard-
// bound or missing a DLQ (Core's RabbitConfig javadoc explains why that matters: an
// unhandled message + default requeue is how this codebase already hit an infinite
// redelivery loop once).
import { ConsumeMessage } from "amqplib";
import { EVENTS_EXCHANGE, getChannel } from "./client";

export interface ConsumeOptions {
  queue: string;
  deadLetterQueue: string;
  /** Explicit routing keys only — never a `#`/`*` wildcard. */
  bindingKeys: string[];
  handler: (msg: ConsumeMessage) => Promise<void>;
}

export async function consume(opts: ConsumeOptions): Promise<void> {
  const channel = getChannel();
  await channel.assertQueue(opts.deadLetterQueue, { durable: true });
  await channel.assertQueue(opts.queue, {
    durable: true,
    deadLetterExchange: "",
    deadLetterRoutingKey: opts.deadLetterQueue,
  });
  for (const key of opts.bindingKeys) {
    await channel.bindQueue(opts.queue, EVENTS_EXCHANGE, key);
  }

  await channel.consume(opts.queue, (msg) => {
    if (!msg) return;
    opts
      .handler(msg)
      .then(() => channel.ack(msg))
      .catch((err) => {
        // No automatic retry — straight to the DLQ on any failure (parse error or
        // otherwise). Trades retry-resilience for never silently looping forever;
        // a DLQ message is visible and re-runnable by hand, an infinite loop isn't.
        console.error(`Error handling message from ${opts.queue}:`, err);
        channel.nack(msg, false, false);
      });
  });
}
