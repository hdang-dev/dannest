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

- **No timeout sweep.** If Core never replies to a `purchase_initiated` event at
  all (crash, a lost message, an extended Core outage), the purchase sits at
  `CHARGED` forever — buyer charged, no grant, no refund, nothing automatic
  resolves it. `CollectionMembershipRepository.findByRevokedAtIsNullAndExpiresAtBefore`
  is already scaffolded for a "stuck-saga sweep" (labeled phase 3) but no scheduled
  job calls it yet.
- **Profile page can't list another user's public collections.** `GET
  /api/v1/collections?scope=PUBLIC` has no `ownerId` filter, so a profile page
  can't show "this user's public collections." Pre-existing, unrelated to Stripe.

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
