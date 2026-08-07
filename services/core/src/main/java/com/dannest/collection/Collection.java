package com.dannest.collection;

import com.dannest.common.BaseEntity;
import com.dannest.media.Media;
import com.dannest.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "collections")
@Getter
public class Collection extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 120)
    @Setter
    private String name;

    @Column(columnDefinition = "text")
    @Setter
    private String description;

    /** The cover image — a media asset (uploaded or external); carries its own crop. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_media_id")
    @Setter
    private Media cover;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Setter
    private Visibility visibility = Visibility.PUBLIC;

    /** Non-null once archived (soft-deleted); archived collections are hidden from listings. */
    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Collection() {
    }

    public Collection(User owner, String name, Visibility visibility) {
        this.owner = owner;
        this.name = name;
        this.visibility = visibility;
    }

    public boolean isArchived() {
        return archivedAt != null;
    }

    /** Soft-delete: mark this collection archived (idempotent). */
    public void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }

    /** Restore a previously archived collection. */
    public void unarchive() {
        archivedAt = null;
    }
}
