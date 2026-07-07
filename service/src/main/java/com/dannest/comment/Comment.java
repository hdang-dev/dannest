package com.dannest.comment;

import com.dannest.common.BaseEntity;
import com.dannest.post.Post;
import com.dannest.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "comments")
public class Comment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    /** Null for a top-level comment; otherwise the comment this one replies to. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_comment_id")
    private Comment parent;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    protected Comment() {
    }

    public Comment(Post post, User author, Comment parent, String content) {
        this.post = post;
        this.author = author;
        this.parent = parent;
        this.content = content;
    }

    public Post getPost() {
        return post;
    }

    public User getAuthor() {
        return author;
    }

    public Comment getParent() {
        return parent;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
