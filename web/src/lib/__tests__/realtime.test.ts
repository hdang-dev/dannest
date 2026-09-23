import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNotificationSocket } from "../realtime";
import { getToken } from "../token";
import { triggerUnauthorized } from "../api";

vi.mock("../token", () => ({ getToken: vi.fn() }));
vi.mock("../api", () => ({ triggerUnauthorized: vi.fn() }));

// A fake STOMP Client that lets the test trigger onConnect/onStompError by hand,
// and records subscribe/deactivate calls — same "capture the handler" idea used
// for the backend's message listeners, just for a client-side socket instead.
const activate = vi.fn();
const deactivate = vi.fn();
const subscribe = vi.fn();
let lastClientConfig: {
  onConnect?: () => void;
  onStompError?: () => void;
} = {};

vi.mock("@stomp/stompjs", () => ({
  // A plain arrow function can't be used as a constructor — `new Client(...)` in the
  // real code needs a real `function` here to support `new`. A constructor that
  // returns an object explicitly makes `new` yield that object instead of `this`.
  Client: vi.fn(function (config: typeof lastClientConfig) {
    lastClientConfig = config;
    return { activate, deactivate, subscribe };
  }),
}));
vi.mock("sockjs-client", () => ({ default: vi.fn() }));

beforeEach(() => {
  activate.mockReset();
  deactivate.mockReset();
  subscribe.mockReset();
  lastClientConfig = {};
});

describe("useNotificationSocket", () => {
  it("does nothing without a user id or a token", () => {
    vi.mocked(getToken).mockReturnValue(null);

    renderHook(() => useNotificationSocket(null, vi.fn()));

    expect(activate).not.toHaveBeenCalled();
  });

  it("connects and subscribes to the user's own topic once both are present", () => {
    vi.mocked(getToken).mockReturnValue("token-123");

    renderHook(() => useNotificationSocket("user-1", vi.fn()));

    expect(activate).toHaveBeenCalled();
    lastClientConfig.onConnect?.();
    expect(subscribe).toHaveBeenCalledWith("/topic/notifications/user-1", expect.any(Function));
  });

  it("delivers an incoming message to the latest onNotification handler", () => {
    vi.mocked(getToken).mockReturnValue("token-123");
    const onNotification = vi.fn();

    renderHook(() => useNotificationSocket("user-1", onNotification));
    lastClientConfig.onConnect?.();
    const subscribedHandler = subscribe.mock.calls[0][1];
    subscribedHandler({ body: JSON.stringify({ id: "n1", message: "hi" }) });

    expect(onNotification).toHaveBeenCalledWith({ id: "n1", message: "hi" });
  });

  it("ends the session instead of retrying forever on a STOMP auth error", () => {
    vi.mocked(getToken).mockReturnValue("token-123");

    renderHook(() => useNotificationSocket("user-1", vi.fn()));
    lastClientConfig.onStompError?.();

    expect(deactivate).toHaveBeenCalled();
    expect(triggerUnauthorized).toHaveBeenCalled();
  });

  it("deactivates the client on unmount", () => {
    vi.mocked(getToken).mockReturnValue("token-123");

    const { unmount } = renderHook(() => useNotificationSocket("user-1", vi.fn()));
    unmount();

    expect(deactivate).toHaveBeenCalled();
  });
});
