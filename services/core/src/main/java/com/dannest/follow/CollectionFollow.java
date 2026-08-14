package com.dannest.follow;

import com.dannest.collection.Collection;
import com.dannest.common.BaseEntity;
import com.dannest.user.User;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** A user following a collection, to be notified when it gets a new post. Unique (follower, collection). */
@Entity
@Table(
    name = "collection_follows",
    uniqueConstraints = @UniqueConstraint(name = "uq_collection_follow", columnNames = {"follower_id", "collection_id"})
)
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollectionFollow extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "follower_id", nullable = false)
    private User follower;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "collection_id", nullable = false)
    private Collection collection;
}
