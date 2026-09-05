// Consumes Core's half of the saga: core.membership.activated / core.membership.rejected.
import { consume } from "../rabbit/consume";
import * as membershipService from "./membershipService";

const QUEUE = "marketplace.saga";
const DEAD_LETTER_QUEUE = "marketplace.saga.dlq";
const ACTIVATED_KEY = "core.membership.activated";
const REJECTED_KEY = "core.membership.rejected";

export async function startMembershipReplyListener(): Promise<void> {
  await consume({
    queue: QUEUE,
    deadLetterQueue: DEAD_LETTER_QUEUE,
    bindingKeys: [ACTIVATED_KEY, REJECTED_KEY],
    handler: async (msg) => {
      const payload = JSON.parse(msg.content.toString("utf-8"));
      switch (msg.fields.routingKey) {
        case ACTIVATED_KEY:
          return membershipService.handleActivated(payload);
        case REJECTED_KEY:
          return membershipService.handleRejected(payload);
        default:
          throw new Error(`Unexpected routing key on ${QUEUE}: ${msg.fields.routingKey}`);
      }
    },
  });
}
