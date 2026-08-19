package com.dannest.post.dto;

import com.dannest.common.CropDto;
import com.dannest.post.PostMedia;

/** One image on a post: the media id, its denormalized url/crop, and position in the post. */
public record PostMediaResponse(String mediaId, String url, CropDto crop, int displayOrder) {

    public static PostMediaResponse from(PostMedia postMedia) {
        return new PostMediaResponse(
                postMedia.getMediaId(), postMedia.getUrl(), CropDto.from(postMedia.getCrop()), postMedia.getDisplayOrder());
    }
}
