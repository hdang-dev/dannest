import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeTime, formatJoinDate } from "../time";

const NOW = new Date("2026-06-15T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe("formatRelativeTime", () => {
  it("shows 'just now' for anything under a minute", () => {
    expect(formatRelativeTime(isoMinutesAgo(0))).toBe("just now");
  });

  it("shows minutes for under an hour", () => {
    expect(formatRelativeTime(isoMinutesAgo(5))).toBe("5m ago");
  });

  it("shows hours for under a day", () => {
    expect(formatRelativeTime(isoMinutesAgo(3 * 60))).toBe("3h ago");
  });

  it("shows days for under a week", () => {
    expect(formatRelativeTime(isoMinutesAgo(2 * 24 * 60))).toBe("2d ago");
  });

  it("shows weeks for under ~5 weeks", () => {
    expect(formatRelativeTime(isoMinutesAgo(10 * 24 * 60))).toBe("1w ago");
  });

  it("shows months for under a year", () => {
    expect(formatRelativeTime(isoMinutesAgo(90 * 24 * 60))).toBe("3mo ago");
  });

  it("shows years beyond that", () => {
    expect(formatRelativeTime(isoMinutesAgo(400 * 24 * 60))).toBe("1y ago");
  });

  it("returns an empty string for an invalid date instead of throwing", () => {
    expect(formatRelativeTime("not-a-date")).toBe("");
  });
});

describe("formatJoinDate", () => {
  it("formats as 'Joined <Month> <Year>'", () => {
    expect(formatJoinDate("2026-03-10T00:00:00Z")).toBe("Joined March 2026");
  });

  it("returns an empty string for an invalid date instead of throwing", () => {
    expect(formatJoinDate("nonsense")).toBe("");
  });
});
