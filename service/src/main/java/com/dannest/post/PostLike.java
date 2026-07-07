package com.dannest.post;

import com.dannest.common.BaseEntity;
import com.dannest.user.User;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** A user's like on a post. Unique (post, user) prevents duplicate likes. */
@Entity
@Table(
    name = "post_likes",
    uniqueConstraints = @UniqueConstraint(name = "uq_post_like", columnNames = {"post_id", "user_id"})
)
public class PostLike extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    protected PostLike() {
    }

    public PostLike(Post post, User user) {
        this.post = post;
        this.user = user;
    }

    public Post getPost() {
        return post;
    }

    public User getUser() {
        return user;
    }
}
