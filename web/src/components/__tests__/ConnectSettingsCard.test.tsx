import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectSettingsCard from "../ConnectSettingsCard";
import { getConnectStatus, startConnectOnboarding } from "@/lib/marketplace";

vi.mock("@/lib/marketplace", () => ({
  getConnectStatus: vi.fn(),
  startConnectOnboarding: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getConnectStatus).mockReset();
  vi.mocked(startConnectOnboarding).mockReset();
});

describe("ConnectSettingsCard", () => {
  it("shows a loading state, then the load error if the status fetch fails", async () => {
    vi.mocked(getConnectStatus).mockRejectedValue(new Error("network down"));

    render(<ConnectSettingsCard />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Couldn't load your payment setup.")).toBeInTheDocument());
  });

  it("shows the connected state once payouts are enabled", async () => {
    vi.mocked(getConnectStatus).mockResolvedValue({ connected: true, chargesEnabled: true, payoutsEnabled: true });

    render(<ConnectSettingsCard />);

    await waitFor(() =>
      expect(screen.getByText(/Stripe connected/)).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers to connect when there's no account yet", async () => {
    vi.mocked(getConnectStatus).mockResolvedValue({ connected: false, chargesEnabled: false, payoutsEnabled: false });

    render(<ConnectSettingsCard />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Connect Stripe" })).toBeInTheDocument());
  });

  it("offers to finish setup when onboarding was started but not completed", async () => {
    vi.mocked(getConnectStatus).mockResolvedValue({ connected: true, chargesEnabled: false, payoutsEnabled: false });

    render(<ConnectSettingsCard />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Finish setup" })).toBeInTheDocument());
  });

  it("redirects to Stripe's onboarding URL when the connect button is clicked", async () => {
    vi.mocked(getConnectStatus).mockResolvedValue({ connected: false, chargesEnabled: false, payoutsEnabled: false });
    vi.mocked(startConnectOnboarding).mockResolvedValue({ url: "https://connect.stripe.com/setup/xyz" });
    // jsdom doesn't implement real navigation — stub just the `href` setter so we
    // can inspect what the component tried to navigate to.
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });

    render(<ConnectSettingsCard />);
    await waitFor(() => screen.getByRole("button", { name: "Connect Stripe" }));
    await userEvent.click(screen.getByRole("button", { name: "Connect Stripe" }));

    await waitFor(() => expect(window.location.href).toBe("https://connect.stripe.com/setup/xyz"));
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("shows an error and re-enables the button if starting onboarding fails", async () => {
    vi.mocked(getConnectStatus).mockResolvedValue({ connected: false, chargesEnabled: false, payoutsEnabled: false });
    vi.mocked(startConnectOnboarding).mockRejectedValue(new Error("stripe down"));

    render(<ConnectSettingsCard />);
    await waitFor(() => screen.getByRole("button", { name: "Connect Stripe" }));
    await userEvent.click(screen.getByRole("button", { name: "Connect Stripe" }));

    await waitFor(() => expect(screen.getByText("Couldn't start Stripe setup. Please try again.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Connect Stripe" })).not.toBeDisabled();
  });
});
