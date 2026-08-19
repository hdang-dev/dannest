package com.dannest.collection;

import com.dannest.common.BaseEntity;
import com.dannest.common.ImageCrop;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "collections")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Collection extends BaseEntity {

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    /** Opaque reference into services/media (a Mongo ObjectId, not a UUID) — no FK,
     * that service owns the asset's lifecycle. */
    @Column(name = "cover_media_id")
    private String coverMediaId;

    /** Denormalized snapshot of the media service's url/crop, copied at write time
     * (see docs/tech/architecture-flows.md's media-split notes). Never live-resolved. */
    @Column(name = "cover_url", length = 1024)
    private String coverUrl;

    @Builder.Default
    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "x", column = @Column(name = "cover_crop_x")),
        @AttributeOverride(name = "y", column = @Column(name = "cover_crop_y")),
        @AttributeOverride(name = "width", column = @Column(name = "cover_crop_width")),
        @AttributeOverride(name = "height", column = @Column(name = "cover_crop_height")),
    })
    private ImageCrop coverCrop = ImageCrop.full();

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Visibility visibility = Visibility.PUBLIC;

    @Column(name = "archived_at")
    private Instant archivedAt;

    public boolean isArchived() {
        return archivedAt != null;
    }

    public void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }

    public void unarchive() {
        archivedAt = null;
    }
}
