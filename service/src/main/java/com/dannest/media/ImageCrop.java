package com.dannest.media;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * A display-time crop: the visible rectangle as fractions (0..1) of the image.
 * Applied with CSS at render time — nothing is re-encoded. The default is the whole
 * image ({@code 0,0,1,1}). Reusable wherever an image is placed (cover, avatar, …).
 */
@Embeddable
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

    public float getX() {
        return x;
    }

    public float getY() {
        return y;
    }

    public float getWidth() {
        return width;
    }

    public float getHeight() {
        return height;
    }
}
