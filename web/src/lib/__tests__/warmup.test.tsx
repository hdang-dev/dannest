import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WarmupBanner } from "../warmup";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WarmupBanner", () => {
  it("pings every health endpoint on mount", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // never resolves — still "warming"

    render(<WarmupBanner />);

    // core, marketplace, notification.
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("shows the banner while a ping is still outstanding", async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

    render(<WarmupBanner />);

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
  });

  it("hides the banner once every ping has settled", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    render(<WarmupBanner />);

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});
