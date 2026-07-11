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

@Entity
@Table(name = "collections")
public class Collection extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    /** The cover image — a media asset (uploaded or external); carries its own crop. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_media_id")
    private Media cover;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
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

    public User getOwner() {
        return owner;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Media getCover() {
        return cover;
    }

    public void setCover(Media cover) {
        this.cover = cover;
    }

    public Visibility getVisibility() {
        return visibility;
    }

    public void setVisibility(Visibility visibility) {
        this.visibility = visibility;
    }

    public Instant getArchivedAt() {
        return archivedAt;
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
