// Consumes Core's half of the saga: core.membership.granted / core.membership.rejected.
import { consume } from "../rabbit/consume";
import * as membershipService from "./membershipService";

const QUEUE = "marketplace.membership-saga.q";
const DEAD_LETTER_QUEUE = "marketplace.membership-saga.dlq";
const GRANTED_KEY = "core.membership.granted";
const REJECTED_KEY = "core.membership.rejected";

export async function startMembershipReplyListener(): Promise<void> {
  await consume({
    queue: QUEUE,
    deadLetterQueue: DEAD_LETTER_QUEUE,
    bindingKeys: [GRANTED_KEY, REJECTED_KEY],
    handler: async (msg) => {
      const payload = JSON.parse(msg.content.toString("utf-8"));
      switch (msg.fields.routingKey) {
        case GRANTED_KEY:
          return membershipService.handleActivated(payload);
        case REJECTED_KEY:
          return membershipService.handleRejected(payload);
        default:
          throw new Error(`Unexpected routing key on ${QUEUE}: ${msg.fields.routingKey}`);
      }
    },
  });
}
