# Marketplace / membership saga — open issues

Known gaps in the membership-purchase saga (Stripe Connect + real Stripe Elements
checkout). Everything below is a deliberate cut or a follow-up, not a surprise.
Full design writeup: [Lesson 8](../lessons/lesson-8-membership-saga.md).

## Deployed — for context

- The marketplace service **is live in production** (Render `dannest-marketplace`,
  MongoDB Atlas, the shared CloudAMQP instance) and wired into
  `.github/workflows/deploy.yml` (`check-marketplace` + `deploy-marketplace`,
  Docker-runtime build on Render).
- A production Stripe webhook endpoint exists (Dashboard → Developers → Webhooks,
  pointing at `…/api/v1/marketplace/stripe/webhook`), its signing secret set as
  `STRIPE_WEBHOOK_SECRET`.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set as a GitHub Actions repo **variable**
  (not a secret — it's publishable) so the web build picks it up.

## Still test-mode only

- Everything runs against Stripe **test-mode** keys. Going live needs the Stripe
  account's identity/business verification completed first (not started). No code
  change — just live keys + the live webhook secret.

## Functional gaps

The first five came out of a deliberate crash-safety pass over the saga: every
point where marketplace, core, a poller, or the link to Stripe/RabbitMQ could
fail. Everything else in that pass is covered by a mechanism (one-transaction
claim+state+outbox, Stripe idempotency keys, durable queues, status guards) or is
an accepted eventual-consistency window. These have no backstop.

- **No timeout sweep for a stalled saga.** If core never replies to a
  `marketplace.membership.charged` event (crash, a lost message, an extended core
  outage), the purchase sits at `CHARGED` forever — buyer charged, no grant, no
  refund, nothing automatic resolves it. *Fix:* a scheduled job that finds
  `CHARGED` purchases past a deadline and refunds them (or re-drives the event).
- **Missed webhook after a long marketplace outage.** Stripe retries
  `payment_intent.succeeded` for ~3 days; past that it gives up. If marketplace is
  down longer, the buyer is charged and stuck at `PENDING_PAYMENT` with no saga.
  *Fix:* on startup / on a schedule, list recent Stripe PaymentIntents and
  reconcile any our records missed.
- **Declined-then-retry charge gets dropped.** A card declined at
  `confirmPayment` fires `payment_intent.payment_failed`, which sets the purchase
  row to `PAYMENT_FAILED`. If the buyer then pays successfully on the *same*
  PaymentIntent (same modal, another card), `markChargedAndStartSaga`'s
  `status !== "PENDING_PAYMENT"` guard drops it — buyer charged, no membership,
  "failed" message. Workaround today: close and reopen the modal (fresh
  PaymentIntent). *Fix:* let a `PAYMENT_FAILED` row still start the saga on a
  later `payment_intent.succeeded`, or mint a fresh PaymentIntent per attempt.
- **Connected-account status can go stale.** `chargesEnabled` / `payoutsEnabled`
  on the `connected_accounts` doc are only refreshed as a side effect of
  `getStatus()` (Profile payments card / New-collection form mount). No
  `account.updated` webhook, no scheduled sync. The frontend gate is unaffected
  (it uses the value `getStatus()` returns live), but the saga's settle step
  reads the cached flag via `requireConnectedAccount()`: if Stripe enabled
  payouts after the creator last loaded Profile, a sale is refunded with
  `no_connected_account` when it needn't be. (The reverse is caught safely by
  `transfers.create` failing for real.) *Fix:* an `account.updated` webhook
  writing straight to the doc. Low priority at current scale — matters before a
  real-creator launch.
- **Orphan Stripe account on a crash during connect.** `findOrCreateAccount`
  calls `stripe.accounts.create` and *then* inserts the `connected_accounts` row.
  A crash in between leaves an empty Stripe account with nothing pointing at it;
  the next connect attempt makes a second one. Harmless (an orphan account holds
  no money and blocks nothing), just untidy and repeatable. *Fix:* insert a
  placeholder row before the Stripe call, or sweep unlinked accounts. Lowest
  priority.
- **Profile page can't list another user's public collections.** `GET
  /api/v1/collections?scope=PUBLIC` has no `ownerId` filter, so a profile page
  can't show "this user's public collections." Pre-existing, unrelated to Stripe.

## Design shortcuts to revisit

- **The frontend polls for the saga result.** After checkout,
  `waitForMembershipPurchase` polls `GET /api/v1/marketplace/memberships/:id`
  every 1s until the status settles; after a refund, `reloadUntilRevoked` polls
  `GET /api/v1/collections/:id` until `viewerHasMembership` flips. It works, but
  it's the buyer's browser hammering an endpoint, and it doesn't scale. The
  project already has the right mechanism — the notification service's
  WebSocket/STOMP push (`/topic/notifications/{userId}`). The saga's terminal
  state should be pushed the same way: marketplace emits a domain event →
  notification (or a small marketplace SSE endpoint) pushes it to the buyer.
  Polling stays as the fallback, same as the notification feed already does.

## Minor / cosmetic

- `MembershipCheckoutModal` creates two `PaymentIntent`s on open in local dev —
  React StrictMode double-invoking the mount effect. Harmless (nothing is charged
  for the orphaned one, it just sits at `PENDING_PAYMENT` forever), just noisy.
- Local dev DB has stale test data from debugging sessions (e.g. a seeded
  members-only collection owned by a synthetic account that will never complete
  Connect onboarding). Fine to ignore or clean up whenever.
- No automated test suite anywhere in the project (pre-existing, not specific to
  this feature).

## Verified working (for context — not a concern)

- Both saga compensation paths: Core rejects → refund; Core grants, settle fails →
  refund + revoke (with the settle-fail *reason* correctly distinguishing "creator
  never connected Stripe" from "some other Stripe-side failure").
- The full happy path: charge → grant → real Stripe transfer to the creator →
  `CONFIRMED`.
- Idempotency across webhook redelivery and RabbitMQ redelivery, including the
  "claim before or after the fallible work" ordering fix (see git log — commit
  `69ba0d4`) and reject-to-DLQ on any listener failure, not just malformed
  payloads (commit `f00ce27`).
