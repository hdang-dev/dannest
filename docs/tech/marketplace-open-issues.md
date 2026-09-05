# Marketplace / membership saga — open issues

Snapshot as of the initial build of the membership-purchase saga (Stripe Connect +
real Stripe Elements checkout). Everything below is a known gap, not a surprise —
review and prioritize before relying on this in production traffic.

## Deploy readiness

- **Nothing has been pushed or deployed yet.** All of this shipped as local commits
  only; `origin/main` doesn't have any of it.
- `deploy-marketplace` in `.github/workflows/deploy.yml` is stubbed `if: false` —
  marketplace has never been wired into the deploy pipeline. Needs a real Render
  service id dropped in once one exists (see `services/marketplace/infra/` for the
  Terraform scaffold — written but never applied).
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` needs to be added as a GitHub Actions repo
  variable (Settings → Actions → Variables) — the web build-args already reference
  it, nothing sets it yet.
- No production Stripe webhook endpoint exists. Locally this uses `stripe listen`
  to forward events to `localhost:8092`; production needs a real webhook endpoint
  registered in the Stripe Dashboard (pointing at the deployed marketplace URL),
  with its own signing secret set as `STRIPE_WEBHOOK_SECRET`.
- Everything has been tested against Stripe **test mode** keys only. Going live
  means switching to live-mode keys, which requires the Stripe account's own
  identity/business verification to be complete first (not started — see the
  earlier "Activate your account" flow that was intentionally not filled in).

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
