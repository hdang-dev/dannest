package com.dannest.post;

import com.dannest.common.BaseEntity;
import com.dannest.common.ImageCrop;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "post_media",
    uniqueConstraints = @UniqueConstraint(name = "uq_post_media", columnNames = {"post_id", "media_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostMedia extends BaseEntity {

    @Column(name = "post_id", nullable = false)
    private UUID postId;

    /** Opaque reference into services/media — no FK, that service owns the asset's lifecycle. */
    @Column(name = "media_id", nullable = false)
    private UUID mediaId;

    /** Denormalized snapshot of the media service's url/crop, copied at write time
     * (see docs/tech/architecture-flows.md's media-split notes). Never live-resolved. */
    @Column(nullable = false, length = 1024)
    private String url;

    @Builder.Default
    @Embedded
    private ImageCrop crop = ImageCrop.full();

    @Column(name = "display_order", nullable = false)
    private int displayOrder;
}
