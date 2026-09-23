import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PostCard from "../PostCard";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/posts";

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("../CommentSection", () => ({ default: () => <div>comment section</div> }));

const basePost: Post = {
  id: "post-1",
  collectionId: "col-1",
  collectionName: "My Collection",
  collectionVisibility: "PUBLIC",
  authorId: "author-1",
  authorUsername: "dan",
  authorAvatarUrl: null,
  authorAvatarCrop: null,
  title: "A great sunset",
  content: null,
  images: [],
  likeCount: 3,
  likedByMe: false,
  commentCount: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
});

describe("PostCard", () => {
  it("shows the title, author, and like/comment counts", () => {
    render(<PostCard post={basePost} onEdit={vi.fn()} onLike={vi.fn()} />);

    expect(screen.getByText("A great sunset")).toBeInTheDocument();
    expect(screen.getByText("dan")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onLike with the post when the like button is clicked", async () => {
    const onLike = vi.fn();
    render(<PostCard post={basePost} onEdit={vi.fn()} onLike={onLike} />);

    await userEvent.click(screen.getByText("3"));

    expect(onLike).toHaveBeenCalledWith(basePost);
  });

  it("toggles the comment section open and closed", async () => {
    render(<PostCard post={basePost} onEdit={vi.fn()} onLike={vi.fn()} />);

    expect(screen.queryByText("comment section")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("2"));
    expect(screen.getByText("comment section")).toBeInTheDocument();
  });

  it("only shows the owner's edit menu to the post's own author", () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: "someone-else" } } as ReturnType<typeof useAuth>);
    render(<PostCard post={basePost} onEdit={vi.fn()} onLike={vi.fn()} />);

    expect(screen.queryByLabelText("Post options")).not.toBeInTheDocument();
  });

  it("lets the author open the menu and edit their post", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: "author-1" } } as ReturnType<typeof useAuth>);
    const onEdit = vi.fn();
    render(<PostCard post={basePost} onEdit={onEdit} onLike={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Post options"));
    await userEvent.click(screen.getByText("Edit"));

    expect(onEdit).toHaveBeenCalledWith(basePost);
  });
});
