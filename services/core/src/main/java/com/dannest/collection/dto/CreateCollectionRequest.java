package com.dannest.collection.dto;

import com.dannest.collection.Visibility;
import com.dannest.common.CropDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of POST /api/v1/collections.
 *
 * <p>{@code visibility} defaults to PUBLIC when omitted. The optional cover is a media
 * asset ({@code coverMediaId}) the caller owns — {@code coverUrl}/{@code coverCrop} must
 * be sent alongside it (the values services/media returned for that id), since Core no
 * longer looks media up itself.
 */
public record CreateCollectionRequest(
        @NotBlank @Size(max = 120) String name,
        String description,
        Visibility visibility,
        String coverMediaId,
        String coverUrl,
        CropDto coverCrop) {
}
