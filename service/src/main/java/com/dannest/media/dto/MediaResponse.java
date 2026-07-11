package com.dannest.media.dto;

import com.dannest.media.Media;
import java.util.UUID;

/** API view of an uploaded/external asset: its id, URL, and display crop. */
public record MediaResponse(UUID id, String url, CropDto crop) {

    public static MediaResponse from(Media media) {
        return new MediaResponse(media.getId(), media.getUrl(), CropDto.from(media.getCrop()));
    }
}
