import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../toast";

function Trigger() {
  const { notify } = useToast();
  return (
    <>
      <button onClick={() => notify("Saved!")}>notify success</button>
      <button onClick={() => notify("Something broke", "error")}>notify error</button>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider / useToast", () => {
  it("shows a toast when notify() is called", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("notify success"));

    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("auto-dismisses after ~4 seconds", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("notify success"));
    expect(screen.getByText("Saved!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
  });

  it("dismisses immediately when the ✕ button is clicked", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("notify success"));
    fireEvent.click(screen.getByLabelText("Dismiss"));

    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
  });

  it("useToast throws outside of a ToastProvider", () => {
    function Lonely() {
      useToast();
      return null;
    }
    // Suppress React's expected error-boundary console noise for this one render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Lonely />)).toThrow("useToast must be used within ToastProvider");

    spy.mockRestore();
  });
});
