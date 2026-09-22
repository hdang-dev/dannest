import { describe, it, expect, vi, beforeEach } from "vitest";
import { onboard, getStatus, requireConnectedAccount } from "../connect.service";
import ConnectedAccount from "../../models/ConnectedAccount";
import { stripe } from "../../stripe/client";
import { BadRequestError } from "../../errors";

vi.mock("../../models/ConnectedAccount", () => ({
  default: { findOne: vi.fn(), create: vi.fn() },
}));

vi.mock("../../stripe/client", () => ({
  stripe: {
    accounts: { create: vi.fn(), retrieve: vi.fn() },
    accountLinks: { create: vi.fn() },
  },
}));

beforeEach(() => {
  vi.mocked(ConnectedAccount.findOne).mockReset();
  vi.mocked(ConnectedAccount.create).mockReset();
  vi.mocked(stripe.accounts.create).mockReset();
  vi.mocked(stripe.accounts.retrieve).mockReset();
  vi.mocked(stripe.accountLinks.create).mockReset();
});

describe("onboard", () => {
  it("reuses an existing connected account instead of creating a new one", async () => {
    vi.mocked(ConnectedAccount.findOne).mockResolvedValue({ stripeAccountId: "acct_existing" } as never);
    vi.mocked(stripe.accountLinks.create).mockResolvedValue({ url: "https://stripe/onboard" } as never);

    const result = await onboard("user-1");

    expect(stripe.accounts.create).not.toHaveBeenCalled();
    expect(stripe.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: "acct_existing" }),
    );
    expect(result).toEqual({ url: "https://stripe/onboard" });
  });

  it("creates a Stripe account and a DB row the first time a user onboards", async () => {
    vi.mocked(ConnectedAccount.findOne).mockResolvedValue(null);
    vi.mocked(stripe.accounts.create).mockResolvedValue({
      id: "acct_new",
      charges_enabled: false,
      payouts_enabled: false,
    } as never);
    vi.mocked(ConnectedAccount.create).mockResolvedValue({ stripeAccountId: "acct_new" } as never);
    vi.mocked(stripe.accountLinks.create).mockResolvedValue({ url: "https://stripe/onboard" } as never);

    await onboard("user-1");

    expect(ConnectedAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", stripeAccountId: "acct_new" }),
    );
  });

  it("reuses the winning row when two onboard() calls race on account creation", async () => {
    vi.mocked(ConnectedAccount.findOne)
      .mockResolvedValueOnce(null) // first lookup: nobody's onboarded yet
      .mockResolvedValueOnce({ stripeAccountId: "acct_winner" } as never); // re-lookup after losing the race
    vi.mocked(stripe.accounts.create).mockResolvedValue({
      id: "acct_new",
      charges_enabled: false,
      payouts_enabled: false,
    } as never);
    const duplicateKeyError = Object.assign(new Error("E11000 duplicate key error"), { code: 11000 });
    vi.mocked(ConnectedAccount.create).mockRejectedValue(duplicateKeyError);
    vi.mocked(stripe.accountLinks.create).mockResolvedValue({ url: "https://stripe/onboard" } as never);

    await onboard("user-1");

    expect(stripe.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: "acct_winner" }),
    );
  });
});

describe("getStatus", () => {
  it("reports not connected without calling Stripe, if there's no account yet", async () => {
    vi.mocked(ConnectedAccount.findOne).mockResolvedValue(null);

    const result = await getStatus("user-1");

    expect(stripe.accounts.retrieve).not.toHaveBeenCalled();
    expect(result).toEqual({ connected: false, chargesEnabled: false, payoutsEnabled: false });
  });

  it("refreshes the cached flags from Stripe when an account exists", async () => {
    const existing = {
      stripeAccountId: "acct_1",
      chargesEnabled: false,
      payoutsEnabled: false,
      save: vi.fn(),
    };
    vi.mocked(ConnectedAccount.findOne).mockResolvedValue(existing as never);
    vi.mocked(stripe.accounts.retrieve).mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: true,
    } as never);

    const result = await getStatus("user-1");

    expect(existing.save).toHaveBeenCalled();
    expect(result).toEqual({ connected: true, chargesEnabled: true, payoutsEnabled: true });
  });
});

describe("requireConnectedAccount", () => {
  it("throws if the user has never onboarded", async () => {
    vi.mocked(ConnectedAccount.findOne).mockResolvedValue(null);

    await expect(requireConnectedAccount("user-1")).rejects.toThrow(BadRequestError);
  });

  it("throws if payouts aren't enabled yet", async () => {
    vi.mocked(ConnectedAccount.findOne).mockResolvedValue({ payoutsEnabled: false } as never);

    await expect(requireConnectedAccount("user-1")).rejects.toThrow(BadRequestError);
  });

  it("returns the account once payouts are enabled", async () => {
    const account = { payoutsEnabled: true };
    vi.mocked(ConnectedAccount.findOne).mockResolvedValue(account as never);

    await expect(requireConnectedAccount("user-1")).resolves.toBe(account);
  });
});
