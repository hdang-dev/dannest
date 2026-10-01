import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInPromptProvider, useRequireLogin } from "../signInPrompt";
import { useAuth } from "../auth";

vi.mock("../auth", () => ({ useAuth: vi.fn() }));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const action = vi.fn();

function LikeButton() {
  const requireLogin = useRequireLogin();
  return <button onClick={() => requireLogin() && action()}>like</button>;
}

function renderWithAuth(auth: { user: unknown; loading: boolean }) {
  vi.mocked(useAuth).mockReturnValue(auth as ReturnType<typeof useAuth>);
  return render(
    <SignInPromptProvider>
      <LikeButton />
    </SignInPromptProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  action.mockReset();
  window.history.pushState({}, "", "/collections/abc");
});

describe("SignInPromptProvider", () => {
  it("lets a signed-in user's action straight through, with no dialog", async () => {
    renderWithAuth({ user: { id: "1" }, loading: false });

    await userEvent.click(screen.getByText("like"));

    expect(action).toHaveBeenCalled();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("stops a signed-out visitor's action and asks them to sign in", async () => {
    renderWithAuth({ user: null, loading: false });

    await userEvent.click(screen.getByText("like"));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("'Sign in' goes to login and remembers this page to come back to", async () => {
    renderWithAuth({ user: null, loading: false });

    await userEvent.click(screen.getByText("like"));
    await userEvent.click(screen.getByText("Sign in"));

    expect(push).toHaveBeenCalledWith("/login?next=%2Fcollections%2Fabc");
  });

  it("'Just browsing' closes the dialog and stays put", async () => {
    renderWithAuth({ user: null, loading: false });

    await userEvent.click(screen.getByText("like"));
    await userEvent.click(screen.getByText("Just browsing"));

    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("doesn't nag while the session is still being restored", async () => {
    renderWithAuth({ user: null, loading: true });

    await userEvent.click(screen.getByText("like"));

    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });
});
