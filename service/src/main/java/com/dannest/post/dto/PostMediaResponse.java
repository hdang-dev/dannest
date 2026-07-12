package com.dannest.post.dto;

import com.dannest.media.Media;
import com.dannest.media.dto.CropDto;
import com.dannest.post.PostMedia;
import java.util.UUID;

/** One image on a post: the media id, its URL, display crop, and position in the post. */
public record PostMediaResponse(UUID mediaId, String url, CropDto crop, int displayOrder) {

    public static PostMediaResponse from(PostMedia postMedia) {
        Media media = postMedia.getMedia();
        return new PostMediaResponse(
                media.getId(), media.getUrl(), CropDto.from(media.getCrop()), postMedia.getDisplayOrder());
    }
}
