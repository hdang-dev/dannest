import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "../auth";
import { refreshSession, setUnauthorizedHandler } from "../api";

vi.mock("../api", () => ({
  refreshSession: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function Consumer() {
  const { user, loading, loginWithGoogle, logout } = useAuth();
  if (loading) return <p>loading</p>;
  return (
    <div>
      <p>{user ? `signed in as ${user.username}` : "signed out"}</p>
      <button onClick={() => loginWithGoogle("id-token")}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

beforeEach(() => {
  vi.mocked(refreshSession).mockReset();
  vi.mocked(setUnauthorizedHandler).mockReset();
  replace.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
});

describe("AuthProvider", () => {
  it("restores the session from the refresh cookie on load", async () => {
    vi.mocked(refreshSession).mockResolvedValue({
      accessToken: "t",
      user: { id: "1", username: "dan" },
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("signed in as dan")).toBeInTheDocument());
  });

  it("stays signed out if there's no valid refresh cookie", async () => {
    vi.mocked(refreshSession).mockResolvedValue(null);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("signed out")).toBeInTheDocument());
  });

  it("signs in via Google and updates the user", async () => {
    vi.mocked(refreshSession).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "t", user: { id: "1", username: "dan" } }), { status: 200 }),
    );

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() => screen.getByText("signed out"));
    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByText("signed in as dan")).toBeInTheDocument());
  });

  it("registers an unauthorized handler that signs the user out and redirects", async () => {
    vi.mocked(refreshSession).mockResolvedValue({
      accessToken: "t",
      user: { id: "1", username: "dan" },
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() => screen.getByText("signed in as dan"));

    const registeredHandler = vi.mocked(setUnauthorizedHandler).mock.calls[0][0];
    registeredHandler?.();

    await waitFor(() => expect(screen.getByText("signed out")).toBeInTheDocument());
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
