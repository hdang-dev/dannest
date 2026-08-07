package com.dannest.post;

import com.dannest.collection.Collection;
import com.dannest.common.BaseEntity;
import com.dannest.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "posts")
@Getter
public class Post extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "collection_id", nullable = false)
    @Setter
    private Collection collection;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(nullable = false, length = 200)
    @Setter
    private String title;

    @Column(columnDefinition = "text")
    @Setter
    private String content;

    protected Post() {
    }

    public Post(Collection collection, User author, String title, String content) {
        this.collection = collection;
        this.author = author;
        this.title = title;
        this.content = content;
    }
}
