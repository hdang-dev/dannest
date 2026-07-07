package com.dannest.media;

import com.dannest.common.BaseEntity;
import com.dannest.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** A generic uploaded asset — a user avatar, collection cover, or post image. */
@Entity
@Table(name = "media")
public class Media extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "storage_key", nullable = false, length = 512)
    private String storageKey;

    @Column(nullable = false, length = 1024)
    private String url;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    private Long size;

    private Integer width;

    private Integer height;

    protected Media() {
    }

    public Media(User owner, String storageKey, String url, String mimeType, Long size, Integer width, Integer height) {
        this.owner = owner;
        this.storageKey = storageKey;
        this.url = url;
        this.mimeType = mimeType;
        this.size = size;
        this.width = width;
        this.height = height;
    }

    public User getOwner() {
        return owner;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getUrl() {
        return url;
    }

    public String getMimeType() {
        return mimeType;
    }

    public Long getSize() {
        return size;
    }

    public Integer getWidth() {
        return width;
    }

    public Integer getHeight() {
        return height;
    }
}
