package com.dannest.common;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;

/**
 * A display-time crop: the visible rectangle as fractions (0..1) of an image. Applied
 * with CSS at render time — nothing is re-encoded. The default is the whole image
 * ({@code 0,0,1,1}). Embedded wherever an image reference is placed (a post's image,
 * a user's avatar, a collection's cover) — column names are remapped per-use via
 * {@code @AttributeOverrides} since each entity can embed more than one.
 */
@Embeddable
@Getter
public class ImageCrop {

    @Column(name = "crop_x", nullable = false)
    private float x = 0f;

    @Column(name = "crop_y", nullable = false)
    private float y = 0f;

    @Column(name = "crop_width", nullable = false)
    private float width = 1f;

    @Column(name = "crop_height", nullable = false)
    private float height = 1f;

    protected ImageCrop() {
    }

    public ImageCrop(float x, float y, float width, float height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    public static ImageCrop full() {
        return new ImageCrop(0f, 0f, 1f, 1f);
    }
}
