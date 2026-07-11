package com.dannest.media;

import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.media.dto.MediaResponse;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/**
 * Stores uploaded images in Cloudflare R2 and tracks them as {@code media} rows.
 *
 * <p>Per the spec the backend does no image processing — it only validates the file,
 * uploads the bytes, records the asset, and returns its id + public URL.
 */
@Service
@Transactional
public class MediaService {

    /** Allowed image types → file extension used in the storage key. */
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "image/webp", "webp",
            "image/jpeg", "jpg",
            "image/png", "png");

    private final S3Client s3;
    private final R2Properties props;
    private final MediaRepository mediaRepository;
    private final UserRepository userRepository;

    public MediaService(
            S3Client s3,
            R2Properties props,
            MediaRepository mediaRepository,
            UserRepository userRepository) {
        this.s3 = s3;
        this.props = props;
        this.mediaRepository = mediaRepository;
        this.userRepository = userRepository;
    }

    /** Upload the (original) image bytes to R2 with an optional display crop. */
    public MediaResponse upload(UUID userId, MultipartFile file, ImageCrop crop) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file provided");
        }
        String contentType = file.getContentType();
        String extension = ALLOWED_TYPES.get(contentType);
        if (extension == null) {
            throw new BadRequestException("Unsupported image type: " + contentType);
        }

        // The client filename is untrusted — build our own key. Namespacing by user
        // keeps a tidy layout and avoids collisions.
        String key = "users/" + userId + "/" + UUID.randomUUID() + "." + extension;

        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(props.bucket())
                        .key(key)
                        .contentType(contentType)
                        .build(),
                toRequestBody(file));

        String url = props.publicBaseUrl() + "/" + key;
        User owner = userRepository.getReferenceById(userId);
        Media media = new Media(owner, key, url, contentType, file.getSize(), null, null);
        if (crop != null) {
            media.setCrop(crop);
        }
        return MediaResponse.from(mediaRepository.save(media));
    }

    /** Register an external image link (no bytes stored) with an optional display crop. */
    public MediaResponse createExternal(UUID userId, String url, ImageCrop crop) {
        if (url == null || url.isBlank()) {
            throw new BadRequestException("No URL provided");
        }
        User owner = userRepository.getReferenceById(userId);
        Media media = Media.external(owner, url.trim());
        if (crop != null) {
            media.setCrop(crop);
        }
        return MediaResponse.from(mediaRepository.save(media));
    }

    /** Update the display crop of an existing (owned) media asset. */
    public MediaResponse updateCrop(UUID userId, UUID mediaId, ImageCrop crop) {
        Media media = findOwned(userId, mediaId);
        media.setCrop(crop);
        return MediaResponse.from(media);
    }

    public void delete(UUID userId, UUID mediaId) {
        Media media = findOwned(userId, mediaId);
        // EXTERNAL media has no bytes in R2 — only delete the object for uploads.
        if (media.getSource() == MediaSource.UPLOAD && media.getStorageKey() != null) {
            s3.deleteObject(DeleteObjectRequest.builder()
                    .bucket(props.bucket())
                    .key(media.getStorageKey())
                    .build());
        }
        mediaRepository.delete(media);
    }

    private Media findOwned(UUID userId, UUID mediaId) {
        Media media = mediaRepository
                .findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media not found: " + mediaId));
        if (!media.getOwner().getId().equals(userId)) {
            throw new ForbiddenException("You do not own this media");
        }
        return media;
    }

    private static RequestBody toRequestBody(MultipartFile file) {
        try {
            return RequestBody.fromInputStream(file.getInputStream(), file.getSize());
        } catch (IOException e) {
            throw new BadRequestException("Could not read uploaded file");
        }
    }
}
