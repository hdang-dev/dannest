package com.dannest.media;

import com.dannest.common.BaseEntity;
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
import lombok.Getter;
import lombok.Setter;

/**
 * A generic image asset. It is either an {@code UPLOAD} (bytes in Cloudflare R2) or an
 * {@code EXTERNAL} link (no bytes stored). It carries its own display-time crop so the
 * same asset can be re-framed without re-encoding.
 */
@Entity
@Table(name = "media")
@Getter
public class Media extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

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

    @Embedded
    @Setter
    private ImageCrop crop = ImageCrop.full();

    protected Media() {
    }

    /** An uploaded asset (bytes stored in R2). */
    public Media(User owner, String storageKey, String url, String mimeType, Long size, Integer width, Integer height) {
        this.owner = owner;
        this.source = MediaSource.UPLOAD;
        this.storageKey = storageKey;
        this.url = url;
        this.mimeType = mimeType;
        this.size = size;
        this.width = width;
        this.height = height;
    }

    /** An external image referenced by URL (nothing stored). */
    public static Media external(User owner, String url) {
        Media media = new Media();
        media.owner = owner;
        media.source = MediaSource.EXTERNAL;
        media.url = url;
        return media;
    }
}
