# Lesson 8 — The membership saga

Creators can sell paid access to a collection. A buyer pays with a card; the
creator gets their cut; the buyer gets a 30-day membership. That single sentence
is a **distributed transaction** — it spans `web`, `services/marketplace`,
Stripe, and `services/core`, four things that can each fail independently, with
no shared database to wrap them in a `BEGIN … COMMIT`.

This lesson is how that's done without a two-phase commit and without an
orchestrator: a **choreography saga**, a **transactional outbox** and
**idempotent inbox** on each side, and two **compensation** paths. It's also the
first service written in a different language (Node + TypeScript) purely because
the point was to build the saga, not to reuse Spring.

The one-line takeaway: **you can't make four services commit together — so make
every step idempotent, retryable, and individually reversible, and let the
system converge.**

---

## 1. Why a saga, and why choreography

A membership purchase has to do all of these or none:

1. charge the buyer (Stripe)
2. record the purchase (marketplace / Mongo)
3. grant the membership (core / Postgres)
4. transfer the creator's cut (Stripe)

There is no transaction that spans a card network, a MongoDB, and a Postgres.
The **saga pattern** is the standard answer: break the work into local steps,
each with a **compensating action** that undoes it, and if a later step fails,
run the compensations for the earlier ones.

Two ways to coordinate a saga:

| | Orchestration | Choreography *(what we did)* |
|---|---|---|
| Who drives | a central "saga orchestrator" service tells each step what to do | each service reacts to events and emits its own |
| Coupling | orchestrator knows every step | each service knows only the events it consumes/emits |
| Visibility | one place to read the whole flow | you follow it across services |
| Fits when | many steps, complex branching | few steps, clear ownership |

We have **two services and four messages**. An orchestrator would be a third
component that exists only to boss around a flow this small. Choreography: the
marketplace owns "money," Core owns "access," and they pass the ball over
RabbitMQ. The cost — no single place to see the whole saga — is paid down by the
sequence diagrams in [architecture-flows.md](../tech/architecture-flows.md) §k.

## 2. The players and the flow

```
web ──REST──> marketplace ──PaymentIntent──> Stripe
                   │  (buyer confirms card directly with Stripe via Elements)
Stripe ──webhook──>│  payment_intent.succeeded
                   │
       marketplace.membership.charged  ──────────────►  core
                                          validate: members-only? price? not owner? not already in?
                   ◄──── core.membership.granted ────  (grant, 30 days)
                   │  OR
                   ◄──── core.membership.rejected ───  (with a reason)
                   │
  granted → transfer creator's cut → CONFIRMED
  rejected → refund → REFUNDED                                    (compensation #1)
  granted but transfer fails → refund + marketplace.membership.payout-failed → core revokes   (compensation #2)
```

Everything asynchronous rides the `dannest.events` topic exchange — the same one
Core already used for notifications ([Lesson 4](lesson-4-microservices.md)).

## 3. Checkout is synchronous; the saga is not

A deliberate split. The buyer's browser does a normal request/response with
marketplace to *set up* the payment, then talks to **Stripe directly** to
confirm the card. The saga only starts when Stripe says — via **webhook** — that
the money actually moved.

```
POST /api/v1/marketplace/memberships { collectionId, priceCents }
  → marketplace: stripe.paymentIntents.create (unconfirmed)
  → marketplace: save MembershipPurchase (PENDING_PAYMENT)
  → 200 { purchaseId, clientSecret }

web: <PaymentElement> + stripe.confirmPayment({ elements })   ← card data never hits our servers
web: poll GET /memberships/{purchaseId} until status leaves PENDING_PAYMENT

Stripe → POST /api/v1/marketplace/stripe/webhook  payment_intent.succeeded
  → THIS is step 1 of the saga
```

Why not start the saga when the browser says payment succeeded? Because the
browser is not a trusted source that money moved, and it might close before
telling us. The webhook is Stripe's server telling our server, signed. The
`clientSecret` the browser gets is scoped to that one PaymentIntent and lets it
confirm the card without our server ever seeing card data (PCI scope stays with
Stripe).

## 4. The transactional outbox

The core problem: a handler needs to **change a row and publish an event**, and
those are in two different systems (a database and RabbitMQ). If it writes the
row then publishes, and the publish fails, the event is lost — the buyer is
`CHARGED` forever with no grant. If it publishes then writes, and the write
fails, there's a grant event for a purchase that was never recorded.

The **outbox** makes the publish part of the database transaction:

```
BEGIN
  update purchase set status = 'CHARGED'
  insert into outbox_event (event_type, payload, published_at = null)
COMMIT
-- ...separately, a poller:
every 1s: select * from outbox_event where published_at is null order by created_at
          → publish each to RabbitMQ → update published_at = now()
```

Now the event and the state change commit together or not at all. RabbitMQ being
down just means the poller retries next tick. Both services do this:

- **Core** — `OutboxWriter.write(...)` inside a `@Transactional` method,
  `OutboxPoller` (`@Scheduled(fixedDelay = 1000)`), `outbox_event` table.
- **Marketplace** — `writeOutboxEvent(session, ...)` inside
  `session.withTransaction(...)`, `startOutboxPoller()`, `outboxevents` collection.

Single instance of each service, by design (same as Notification —
[Lesson 6](lesson-6-feed-cache-and-trending.md) §4), so the poller needs no
`SKIP LOCKED` / row-claim dance — just "unpublished, oldest first."

> **Does the 1s poller keep the Render free service awake / burn the quota?**
> No. Render's free-tier sleep is triggered by lack of **inbound HTTP**; an
> internal timer doesn't count. The poller runs while the service is up and
> stops when it sleeps — and a sleeping producer just means its outbox drains a
> few seconds later when something wakes it.

## 5. The idempotent inbox — and the bug in where you put the claim

RabbitMQ is **at-least-once**: a consumer can see the same message twice (redelivery
after a connection blip, a manual DLQ replay). Processing `core.membership.granted`
twice would transfer the creator's cut twice. The **inbox** guards this:

```
inbox_event (event_id, consumer)  PRIMARY KEY (event_id, consumer)
```

A handler claims the event — `INSERT … ON CONFLICT DO NOTHING` (Core) / insert
and catch duplicate-key (marketplace) — and if the claim was already taken, it
returns early. **The claim must be in the same transaction as the effect**, or a
crash between "claimed" and "committed effect" loses the work forever.

### The bug (commit `69ba0d4`)

The first version claimed the event *first*, then did the Stripe call:

```
// WRONG
await claim(eventId, "marketplace.membership");   // marks it done
await stripe.transfers.create(...);               // ...but this can still fail
```

If `transfers.create` hit a transient error (network, a 500 from Stripe, a
rate-limit), the handler threw — but the claim had **already committed**. The
redelivery found the event claimed and skipped straight past it. Result: Core
granted the membership, the creator was never paid, and there was no record that
anything was owed. Money silently dropped.

The fix — **do the fallible external thing first, claim only once it's succeeded**:

```
// RIGHT
await stripe.transfers.create(..., { idempotencyKey: `membership-transfer:${purchaseId}` });
await withTransaction(async (session) => {
  if (!(await claimInTransaction(session, eventId, "marketplace.membership"))) return;
  purchase.status = "CONFIRMED";
  await purchase.save({ session });
});
```

Now a transient Stripe failure just means the message redelivers and the whole
handler runs again. The **Stripe idempotency key** is the other half: if the
transfer *did* actually go through and only the response was lost, the retry
reuses the original transfer instead of creating a second one. Same pattern for
every refund (`membership-settle-refund:<id>`, `membership-reject-refund:<id>`).

> **Rule:** claim-then-work is only safe when "work" is another database write in
> the same transaction. The moment a step is an external call that can fail
> independently, the claim goes *after* it, and the external call gets an
> idempotency key.

## 6. Compensation — the two ways this rolls back

**Compensation #1 — Core rejects the purchase.** Collection isn't members-only
any more, price changed, buyer is the owner, buyer is already a member, or the
collection is gone. Core emits `core.membership.rejected { reason }`. Marketplace
refunds the PaymentIntent and sets the purchase `REFUNDED`. Done — Core never
granted anything, so there's nothing to undo on its side.

**Compensation #2 — Core granted, but the transfer fails.** Usually: the creator
started selling but never finished Stripe Connect onboarding, so there's no
payouts-enabled account to transfer to. Could also be any Stripe-side failure.
Now there *is* a grant to undo:

1. marketplace refunds the buyer
2. marketplace sets `REFUNDED` with a `reason` — `"no_connected_account"` if the
   creator has no usable account, `"settle_failed"` for anything else
3. marketplace emits `marketplace.membership.payout-failed`
4. Core consumes it (a *separate* queue, `core.membership-payout-failed.q`) and
   **revokes** the membership it granted — `revoke()` sets `revoked_at` and is
   idempotent

The `reason` split matters for honesty in the UI (commit `ed12e7e`): "the
creator hasn't set up payouts" and "something went wrong on Stripe's end, you've
been refunded" are different messages, and showing the first when the real cause
was a test-mode `balance_insufficient` was just wrong.

### The post-refund UI race (also `ed12e7e`)

Marketplace sets `REFUNDED` and emits the event; Core revokes a beat later when
it consumes it. In that gap the collection page still showed "unlocked." Fix:
after a refund result, `web` polls `getCollection(id)` until
`!viewerHasMembership` before showing the final state — `reloadUntilRevoked()`.
The saga is eventually consistent; the UI has to wait for it to converge rather
than read Core mid-flight.

## 7. Don't let a bad message loop forever (commit `f00ce27`)

Spring AMQP's default on a listener exception is **requeue and retry** — forever.
A deterministic failure (a malformed payload, a bug, a row that violates a
constraint) then redelivers and fails identically, pinning a CPU and burying real
messages. Every saga listener (and, retroactively, the notification consumers)
now wraps its work:

```java
try {
    process(event);
} catch (Exception e) {
    throw new AmqpRejectAndDontRequeueException(e);   // → dead-letter, don't loop
}
```

Each queue is declared with `x-dead-letter-exchange: ""` +
`x-dead-letter-routing-key: <queue>.dlq`, so a rejected message lands in a
sibling `.dlq` queue you can inspect and replay by hand. We reproduced the loop
live first (a fabricated JWT for a user id that doesn't exist → FK violation on
every redelivery) to be sure the fix actually caught it.

## 8. Naming: routing keys vs queues (commit `3501134`)

The first cut named things ad hoc (`mkt.membership.purchase_initiated`,
`core.marketplace`, …) and it got confusing fast. Standardized on the convention
most RabbitMQ guides converge on:

- **Routing key = a fact about what happened:**
  `<publisher>.<aggregate>.<past-tense-verb>` —
  `marketplace.membership.charged`, `core.membership.granted`,
  `core.membership.rejected`, `marketplace.membership.payout-failed`.
- **Queue = a consumer's mailbox:** `<consumer>.<intent>` with a `.q` / `.dlq`
  suffix so it never reads like a routing key —
  `core.membership-saga.q`, `marketplace.membership-saga.q`,
  `core.membership-payout-failed.q`.
- **Bind to explicit keys, never a wildcard.** A key a listener can't parse
  reaching it is exactly what turned into the §7 loop. Two keys a consumer cares
  about that need *different* handling (the saga reply vs the payout-failed
  signal) go to **two queues**, not one queue bound twice — the saga listener
  parses every message strictly as one type.

Renaming queues in place fails (`PRECONDITION_FAILED` — you can't redeclare a
queue with changed arguments), so the migration was: deploy with the new names
(new queues created automatically), confirm traffic flows, then delete the old
queues by hand from CloudAMQP.

## 9. The Stripe pieces

Only three npm packages, doing a lot:

| Package | Used for |
|---|---|
| `stripe` (server) | `paymentIntents.create`, `transfers.create`, `refunds.create`, `accounts.create` / `.retrieve`, `accountLinks.create`, `webhooks.constructEvent` |
| `@stripe/stripe-js` (browser) | loads Stripe's runtime script, exposes the publishable-key client |
| `@stripe/react-stripe-js` (browser) | `<Elements>`, `<PaymentElement>`, `useStripe`, `useElements`, `stripe.confirmPayment` |

- **Connect (Express accounts)** — each creator gets a Stripe-managed account
  (`accounts.create({ type: "express" })`); onboarding is a Stripe-hosted form
  reached through a short-lived `accountLinks` URL. Our `ConnectedAccount` row's
  `payoutsEnabled` is a cache of `accounts.retrieve(...)`, refreshed on every
  status check.
- **PaymentIntent + Elements** — server creates an unconfirmed intent and hands
  the browser its `clientSecret`; `<PaymentElement>` collects the card inside a
  Stripe iframe; `confirmPayment({ elements, redirect: "if_required" })` confirms
  it. Our server never sees a card number.
- **Transfer** — `transfers.create({ amount, destination: acct_… })` moves the
  creator's cut from the platform balance to their account. In test mode the
  platform balance must be primed first (`4000000000000077`).
- **Refund** — `refunds.create({ payment_intent })` for both compensation paths.
- **Webhook** — `webhooks.constructEvent(rawBody, sig, whsec_…)` verifies
  Stripe's signature over the **raw** bytes, so the route is mounted with
  `express.raw()` before `express.json()` and outside auth.
- **Idempotency keys** on every `create` that moves money (see §5).

## 10. What you achieved ✅

- A real distributed transaction with no 2PC and no orchestrator — a choreography
  saga across two services, two databases, and Stripe.
- Transactional outbox + idempotent inbox on both a relational and a document
  store, so no event is lost and no redelivery double-charges.
- Two compensation paths, including one that reaches back across the service
  boundary to revoke a grant the other service made.
- Learned the claim-ordering rule the hard way (money silently dropped) and fixed
  it with reordering + Stripe idempotency keys.
- Reject-to-DLQ on every listener, reproduced the infinite loop it prevents.
- A consistent RabbitMQ naming convention, migrated in production without
  downtime.
- A second backend language (Node/TS) added to the mesh with the same contracts
  (JWT verification, `dannest.events`, health endpoint) as the Spring services.

## Cheat sheet 📇

| Problem | Answer |
|---|---|
| Commit across a DB + a broker | Transactional outbox — insert the event row in the business transaction, a poller publishes it |
| Commit across a DB + Stripe | You can't. Make the step idempotent + retryable, put an idempotency key on the Stripe call |
| Redelivery double-applies an effect | Inbox row `(event_id, consumer)`, claimed **in the same transaction** as the effect |
| Where to claim vs an external call | External call first, claim after it succeeds — else a transient failure marks the event done forever |
| A step fails after earlier steps committed | Compensating action per earlier step; emit an event so the other service runs its own |
| A bad message retries forever | `AmqpRejectAndDontRequeueException` + a `.dlq` queue |
| Eventually-consistent state in the UI | Poll until it converges; don't read mid-saga |
| Two events, different handling | Two queues, not one queue bound to both keys |

## Key words

- **Saga** — a sequence of local transactions, each with a compensating action;
  the fallback for "one transaction" when no transaction can span the work.
- **Choreography vs orchestration** — services react to events and emit their own
  vs a central coordinator driving each step.
- **Transactional outbox** — write the "to publish" event into the same DB
  transaction as the state change; a poller does the real publish.
- **Idempotent consumer / inbox** — a dedup table keyed by `(event_id, consumer)`,
  claimed in the effect's transaction, so at-least-once delivery is safe.
- **Compensating transaction** — the semantic undo of a completed step (refund,
  revoke) — not a rollback, because the original already committed.
- **Idempotency key** — a client-supplied token that makes a repeated create call
  return the original result instead of doing it twice.
- **At-least-once delivery** — the broker guarantees a message arrives, not that
  it arrives once; the consumer is responsible for dedup.
- **Dead-letter queue** — where a message goes when a consumer rejects it without
  requeue, instead of looping.
