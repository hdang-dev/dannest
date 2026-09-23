import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("shows the title and message", () => {
    render(<ConfirmDialog title="Delete post?" message="This can't be undone." onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText("Delete post?")).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={onConfirm} onCancel={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when clicking the backdrop", async () => {
    const onCancel = vi.fn();
    const { container } = render(<ConfirmDialog title="t" message="m" onConfirm={vi.fn()} onCancel={onCancel} />);

    await userEvent.click(container.firstChild as HTMLElement);

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables both buttons while busy", () => {
    render(<ConfirmDialog title="t" message="m" busy onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Please wait…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
