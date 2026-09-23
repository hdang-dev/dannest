import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell from "../NotificationBell";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { useAuth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/realtime", () => ({ useNotificationSocket: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function notification(overrides: Partial<import("@/lib/notifications").Notification> = {}) {
  return {
    id: "n1",
    actorId: "actor-1",
    actorUsername: "dan",
    actorAvatarUrl: null,
    type: "FOLLOW" as const,
    message: "followed your collection",
    targetUrl: "/collections/col-1",
    read: false,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: "u1" } } as ReturnType<typeof useAuth>);
  vi.mocked(markAllNotificationsRead).mockResolvedValue(undefined);
  vi.mocked(markNotificationRead).mockResolvedValue(undefined);
  push.mockReset();
});

describe("NotificationBell", () => {
  it("shows the unread count badge", async () => {
    vi.mocked(listNotifications).mockResolvedValue({
      content: [notification({ id: "1", read: false }), notification({ id: "2", read: true })],
      totalElements: 2, totalPages: 1, page: 0, size: 20, last: true,
    });

    render(<NotificationBell />);

    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
  });

  it("opens the dropdown and lists notifications", async () => {
    vi.mocked(listNotifications).mockResolvedValue({
      content: [notification()],
      totalElements: 1, totalPages: 1, page: 0, size: 20, last: true,
    });

    render(<NotificationBell />);
    await waitFor(() => screen.getByLabelText("Notifications"));
    await userEvent.click(screen.getByLabelText("Notifications"));

    expect(screen.getByText("followed your collection")).toBeInTheDocument();
  });

  it("marks all as read", async () => {
    vi.mocked(listNotifications).mockResolvedValue({
      content: [notification({ read: false })],
      totalElements: 1, totalPages: 1, page: 0, size: 20, last: true,
    });

    render(<NotificationBell />);
    await userEvent.click(screen.getByLabelText("Notifications"));
    await userEvent.click(screen.getByText("Mark all read"));

    expect(markAllNotificationsRead).toHaveBeenCalled();
    expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
  });

  it("marks a notification read and navigates to it when clicked", async () => {
    vi.mocked(listNotifications).mockResolvedValue({
      content: [notification({ id: "n1", read: false, targetUrl: "/collections/col-1" })],
      totalElements: 1, totalPages: 1, page: 0, size: 20, last: true,
    });

    render(<NotificationBell />);
    await userEvent.click(screen.getByLabelText("Notifications"));
    await userEvent.click(screen.getByText("followed your collection"));

    expect(markNotificationRead).toHaveBeenCalledWith("n1");
    expect(push).toHaveBeenCalledWith("/collections/col-1");
  });
});
