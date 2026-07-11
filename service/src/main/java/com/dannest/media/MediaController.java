package com.dannest.media;

import com.dannest.media.dto.CropDto;
import com.dannest.media.dto.ExternalMediaRequest;
import com.dannest.media.dto.MediaResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/media")
public class MediaController {

    private final MediaService mediaService;

    public MediaController(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    /** Upload the original image (multipart) with an optional display crop → stored in R2. */
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<MediaResponse> upload(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "0") float cropX,
            @RequestParam(defaultValue = "0") float cropY,
            @RequestParam(defaultValue = "1") float cropWidth,
            @RequestParam(defaultValue = "1") float cropHeight) {
        ImageCrop crop = new ImageCrop(cropX, cropY, cropWidth, cropHeight);
        MediaResponse created = mediaService.upload(currentUserId(jwt), file, crop);
        return ResponseEntity.created(URI.create("/api/v1/media/" + created.id())).body(created);
    }

    /** Register an external image link (no bytes stored) with an optional display crop. */
    @PostMapping("/external")
    public ResponseEntity<MediaResponse> external(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ExternalMediaRequest request) {
        ImageCrop crop = request.crop() != null ? request.crop().toEntity() : ImageCrop.full();
        MediaResponse created = mediaService.createExternal(currentUserId(jwt), request.url(), crop);
        return ResponseEntity.created(URI.create("/api/v1/media/" + created.id())).body(created);
    }

    /** Update the display crop of an existing media asset. */
    @PatchMapping("/{id}")
    public MediaResponse updateCrop(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @RequestBody CropDto crop) {
        return mediaService.updateCrop(currentUserId(jwt), id, crop.toEntity());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        mediaService.delete(currentUserId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private static UUID currentUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
