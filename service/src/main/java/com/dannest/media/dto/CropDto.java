package com.dannest.media.dto;

import com.dannest.media.ImageCrop;

/** A crop rectangle as fractions (0..1) of the image. */
public record CropDto(float x, float y, float width, float height) {

    public static CropDto from(ImageCrop crop) {
        return new CropDto(crop.getX(), crop.getY(), crop.getWidth(), crop.getHeight());
    }

    public ImageCrop toEntity() {
        return new ImageCrop(x, y, width, height);
    }
}
