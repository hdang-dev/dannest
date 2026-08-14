package com.dannest.media;

import com.dannest.common.SoftDeletableEntity;
import com.dannest.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.EnumType;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A generic image asset. It is either an {@code UPLOAD} (bytes in Cloudflare R2) or an
 * {@code EXTERNAL} link (no bytes stored). It carries its own display-time crop so the
 * same asset can be re-framed without re-encoding.
 */
@Entity
@Table(name = "media")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Media extends SoftDeletableEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MediaSource source = MediaSource.UPLOAD;

    /** R2 object key — null for EXTERNAL media. */
    @Column(name = "storage_key", length = 512)
    private String storageKey;

    @Column(nullable = false, length = 1024)
    private String url;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    private Long size;

    private Integer width;

    private Integer height;

    @Builder.Default
    @Embedded
    @Setter
    private ImageCrop crop = ImageCrop.full();

    /** An external image referenced by URL (nothing stored). */
    public static Media external(User owner, String url) {
        return Media.builder()
                .owner(owner)
                .source(MediaSource.EXTERNAL)
                .url(url)
                .build();
    }
}
