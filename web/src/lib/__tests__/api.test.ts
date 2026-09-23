import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, refreshSession, setUnauthorizedHandler, ApiError } from "../api";
import { setToken, clearToken } from "../token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  clearToken();
  setUnauthorizedHandler(null);
  vi.stubGlobal("fetch", vi.fn());
});

describe("apiFetch", () => {
  it("returns the parsed JSON body on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await apiFetch<{ ok: boolean }>("/api/v1/posts");

    expect(result).toEqual({ ok: true });
  });

  it("sends the bearer token when one is set", async () => {
    setToken("token-123");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}));

    await apiFetch("/api/v1/posts");

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-123");
  });

  it("returns undefined for a 204 No Content", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await apiFetch("/api/v1/posts/1/likes", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  it("throws ApiError for a non-2xx, non-401 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(apiFetch("/api/v1/posts")).rejects.toMatchObject({ status: 500 });
  });

  it("silently retries once after a 401, using a fresh token from a successful refresh", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // the original request
      .mockResolvedValueOnce(jsonResponse({ accessToken: "new-token", user: {} })) // refresh
      .mockResolvedValueOnce(jsonResponse({ ok: true })); // the retried request

    const result = await apiFetch<{ ok: boolean }>("/api/v1/posts");

    expect(result).toEqual({ ok: true });
    const retryHeaders = vi.mocked(fetch).mock.calls[2][1]?.headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe("Bearer new-token");
  });

  it("ends the session if the refresh also fails", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // the original request
      .mockResolvedValueOnce(new Response(null, { status: 401 })); // refresh also fails

    await expect(apiFetch("/api/v1/posts")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalled();
  });
});

describe("refreshSession", () => {
  it("only makes one real request even when called concurrently (single-flight)", async () => {
    let resolveFetch!: (res: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => (resolveFetch = resolve)));

    const first = refreshSession();
    const second = refreshSession(); // fired before the first has resolved

    resolveFetch(jsonResponse({ accessToken: "t", user: {} }));
    await Promise.all([first, second]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("a later call starts a genuinely new request once the first has finished", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ accessToken: "t1", user: {} }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "t2", user: {} }));

    await refreshSession();
    await refreshSession();

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
