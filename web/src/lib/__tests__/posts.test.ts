import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch } from "../api";
import { listFeed, listByCollection, createPost, likePost, unlikePost } from "../posts";

vi.mock("../api", () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("posts API client", () => {
  it("builds a query string, skipping empty/missing params", async () => {
    await listFeed({ q: "sunset", page: 2 });

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/posts?scope=FEED&q=sunset&page=2");
  });

  it("omits the query string entirely when there's nothing to filter by", async () => {
    await listByCollection("col-1");

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/collections/col-1/posts");
  });

  it("sends a POST with a JSON body to create a post", async () => {
    const input = { collectionId: "col-1", title: "Hello" };

    await createPost(input);

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/posts", { method: "POST", body: JSON.stringify(input) });
  });

  it("likes and unlikes hit the same endpoint with different methods", async () => {
    await likePost("post-1");
    await unlikePost("post-1");

    expect(apiFetch).toHaveBeenNthCalledWith(1, "/api/v1/posts/post-1/likes", { method: "POST" });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/api/v1/posts/post-1/likes", { method: "DELETE" });
  });
});
