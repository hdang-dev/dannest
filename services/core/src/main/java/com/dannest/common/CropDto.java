package com.dannest.common;

/** A crop rectangle as fractions (0..1) of the image. */
public record CropDto(float x, float y, float width, float height) {

    public static CropDto from(ImageCrop crop) {
        if (crop == null) return null;
        return new CropDto(crop.getX(), crop.getY(), crop.getWidth(), crop.getHeight());
    }

    public ImageCrop toEntity() {
        return new ImageCrop(x, y, width, height);
    }
}
