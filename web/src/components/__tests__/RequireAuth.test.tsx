import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RequireAuth from "../RequireAuth";
import { useAuth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  replace.mockReset();
  window.history.pushState({}, "", "/");
});

describe("RequireAuth", () => {
  it("shows a loading state instead of children while the session is still resolving", () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);

    render(
      <RequireAuth>
        <div>secret content</div>
      </RequireAuth>,
    );

    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to /login once loading is done and there's no user", () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);

    render(
      <RequireAuth>
        <div>secret content</div>
      </RequireAuth>,
    );

    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("keeps a deep link so login can send the visitor back to it", () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);
    window.history.pushState({}, "", "/activity?tab=mine");

    render(
      <RequireAuth>
        <div>secret content</div>
      </RequireAuth>,
    );

    expect(replace).toHaveBeenCalledWith("/login?next=%2Factivity%3Ftab%3Dmine");
  });

  it("renders children once a user is present", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "1", username: "dan" },
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(
      <RequireAuth>
        <div>secret content</div>
      </RequireAuth>,
    );

    expect(screen.getByText("secret content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
