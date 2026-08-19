package com.dannest.post.dto;

import com.dannest.common.CropDto;
import com.dannest.post.PostMedia;
import java.util.UUID;

/** One image on a post: the media id, its denormalized url/crop, and position in the post. */
public record PostMediaResponse(UUID mediaId, String url, CropDto crop, int displayOrder) {

    public static PostMediaResponse from(PostMedia postMedia) {
        return new PostMediaResponse(
                postMedia.getMediaId(), postMedia.getUrl(), CropDto.from(postMedia.getCrop()), postMedia.getDisplayOrder());
    }
}
