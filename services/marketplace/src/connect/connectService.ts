// Stripe Connect Express onboarding — the one-time step that lets a creator receive
// their cut of a membership sale (see docs/lessons on the membership saga once it
// exists). Core never sees any of this; it only ever hears a userId back from us.
import ConnectedAccount, { ConnectedAccountDocument } from "./ConnectedAccount";
import { stripe } from "../stripe/client";
import { env } from "../config/env";
import { BadRequestError } from "../errors";

export interface OnboardResult {
  url: string;
}

export interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

/** Find this user's connected account, or create one in Stripe if they've never started. */
async function findOrCreateAccount(userId: string): Promise<ConnectedAccountDocument> {
  const existing = await ConnectedAccount.findOne({ userId });
  if (existing) return existing;

  const account = await stripe.accounts.create({
    type: "express",
    metadata: { dannestUserId: userId },
  });

  try {
    return await ConnectedAccount.create({
      userId,
      stripeAccountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (err) {
    // Unique-index race: two concurrent onboard() calls for the same user. Whoever lost
    // the insert reuses the winner's row instead of leaving an orphan Stripe account.
    if (isDuplicateKeyError(err)) {
      const winner = await ConnectedAccount.findOne({ userId });
      if (winner) return winner;
    }
    throw err;
  }
}

/**
 * Start (or resume) Connect onboarding: returns a fresh Stripe-hosted link. Account
 * links expire in minutes, so this never caches a URL — always issue a new one.
 */
export async function onboard(userId: string): Promise<OnboardResult> {
  const account = await findOrCreateAccount(userId);
  const link = await stripe.accountLinks.create({
    account: account.stripeAccountId,
    refresh_url: env.stripe.connectRefreshUrl,
    return_url: env.stripe.connectReturnUrl,
    type: "account_onboarding",
  });
  return { url: link.url };
}

/** Current onboarding status, refreshed live from Stripe (our copy is a cache, not the source of truth). */
export async function getStatus(userId: string): Promise<ConnectStatus> {
  const existing = await ConnectedAccount.findOne({ userId });
  if (!existing) {
    return { connected: false, chargesEnabled: false, payoutsEnabled: false };
  }
  const account = await stripe.accounts.retrieve(existing.stripeAccountId);
  existing.chargesEnabled = account.charges_enabled;
  existing.payoutsEnabled = account.payouts_enabled;
  await existing.save();
  return { connected: true, chargesEnabled: existing.chargesEnabled, payoutsEnabled: existing.payoutsEnabled };
}

/** Used by the membership saga's settle step (once it exists) to find where to transfer. */
export async function requireConnectedAccount(userId: string): Promise<ConnectedAccountDocument> {
  const account = await ConnectedAccount.findOne({ userId });
  if (!account || !account.payoutsEnabled) {
    throw new BadRequestError(`User ${userId} has no payouts-enabled connected account`);
  }
  return account;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
