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

    /** Reference to a {@code media} row's id — no FK (varchar(64): historically held
     * Mongo ObjectIds; new rows are UUIDs). See {@link com.dannest.media.Media}. */
    @Column(name = "media_id", nullable = false)
    private String mediaId;

    /** Denormalized snapshot of the media row's url/crop, copied at write time
     * (see docs/tech/db-schema.md's *Image crop* notes). Never live-resolved. */
    @Column(nullable = false, length = 1024)
    private String url;

    @Builder.Default
    @Embedded
    private ImageCrop crop = ImageCrop.full();

    @Column(name = "display_order", nullable = false)
    private int displayOrder;
}
