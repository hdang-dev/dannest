import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommentSection from "../CommentSection";
import { listComments, createComment, deleteComment } from "@/lib/comments";
import { useAuth } from "@/lib/auth";
import type { Comment } from "@/lib/comments";

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/comments", () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    postId: "post-1",
    authorId: "author-1",
    authorUsername: "dan",
    authorAvatarUrl: null,
    authorAvatarCrop: null,
    parentCommentId: null,
    content: "Nice post!",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function page(content: Comment[]) {
  return { content, page: 0, size: 10, totalElements: content.length, totalPages: 1, last: true };
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: "author-1" } } as ReturnType<typeof useAuth>);
  vi.mocked(deleteComment).mockResolvedValue(undefined);
});

describe("CommentSection", () => {
  it("shows an empty state when there are no comments", async () => {
    vi.mocked(listComments).mockResolvedValue(page([]));

    render(<CommentSection postId="post-1" initialCount={0} />);

    await waitFor(() =>
      expect(screen.getByText("No comments yet — be the first to say something.")).toBeInTheDocument(),
    );
  });

  it("lists existing comments", async () => {
    vi.mocked(listComments).mockResolvedValue(page([comment({ content: "First!" })]));

    render(<CommentSection postId="post-1" initialCount={1} />);

    await waitFor(() => expect(screen.getByText("First!")).toBeInTheDocument());
  });

  it("shows a load error instead of hanging forever", async () => {
    vi.mocked(listComments).mockRejectedValue(new Error("network down"));

    render(<CommentSection postId="post-1" initialCount={0} />);

    await waitFor(() => expect(screen.getByText("Couldn't load comments.")).toBeInTheDocument());
  });

  it("posts a new top-level comment and clears the composer", async () => {
    vi.mocked(listComments).mockResolvedValue(page([]));
    vi.mocked(createComment).mockResolvedValue(comment({ id: "new-1", content: "Hello there" }));
    const onCountChange = vi.fn();

    render(<CommentSection postId="post-1" initialCount={0} onCountChange={onCountChange} />);
    await waitFor(() => screen.getByPlaceholderText("Write a comment…"));

    const textarea = screen.getByPlaceholderText("Write a comment…");
    await userEvent.type(textarea, "Hello there");
    await userEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => expect(screen.getByText("Hello there")).toBeInTheDocument());
    expect(textarea).toHaveValue("");
    expect(onCountChange).toHaveBeenLastCalledWith(1);
  });

  it("deleting a comment also removes its replies, locally and on the server", async () => {
    const parent = comment({ id: "parent", content: "Parent" });
    const reply = comment({ id: "reply", parentCommentId: "parent", content: "A reply" });
    vi.mocked(listComments).mockResolvedValue(page([parent, reply]));

    render(<CommentSection postId="post-1" initialCount={2} />);
    await waitFor(() => screen.getByText("Parent"));
    expect(screen.getByText("A reply")).toBeInTheDocument();

    // Open the parent's "More" menu and delete it.
    const moreButtons = screen.getAllByText("More");
    await userEvent.click(moreButtons[0]);
    await userEvent.click(screen.getByText("Delete"));

    expect(screen.queryByText("Parent")).not.toBeInTheDocument();
    expect(screen.queryByText("A reply")).not.toBeInTheDocument();
    expect(deleteComment).toHaveBeenCalledWith("parent");
    // Only the parent's own delete is called — its reply is dropped locally, not
    // deleted separately (the backend cascades it server-side).
    expect(deleteComment).toHaveBeenCalledTimes(1);
  });

  it("only shows the More menu (edit/delete) to the comment's own author", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: "someone-else" } } as ReturnType<typeof useAuth>);
    vi.mocked(listComments).mockResolvedValue(page([comment({ authorId: "author-1" })]));

    render(<CommentSection postId="post-1" initialCount={1} />);

    await waitFor(() => screen.getByText("Nice post!"));
    expect(screen.queryByText("More")).not.toBeInTheDocument();
  });
});
