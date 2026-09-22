package com.dannest.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.common.BadRequestException;
import com.dannest.common.ForbiddenException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@ExtendWith(MockitoExtension.class)
class MediaServiceTest {

    @Mock
    private S3Client s3;

    @Mock
    private MediaRepository mediaRepository;

    private MediaService mediaService;

    @BeforeEach
    void setUp() {
        R2Properties props = new R2Properties("acct", "key", "secret", "bucket", "https://pub.example.com");
        mediaService = new MediaService(s3, props, mediaRepository);
    }

    @Test
    void rejectsAnEmptyFile() {
        MockMultipartFile empty = new MockMultipartFile("file", "a.jpg", "image/jpeg", new byte[0]);

        assertThatThrownBy(() -> mediaService.upload(UUID.randomUUID(), empty, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsAnUnsupportedImageType() {
        MockMultipartFile file = new MockMultipartFile("file", "a.gif", "image/gif", new byte[] {1, 2, 3});

        assertThatThrownBy(() -> mediaService.upload(UUID.randomUUID(), file, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void uploadsAValidImageAndRecordsIt() {
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", new byte[] {1, 2, 3});
        UUID userId = UUID.randomUUID();
        when(mediaRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = mediaService.upload(userId, file, null);

        verify(s3).putObject(any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class));
        assertThat(response.url()).startsWith("https://pub.example.com/users/" + userId + "/");
    }

    @Test
    void rejectsABlankExternalUrl() {
        assertThatThrownBy(() -> mediaService.createExternal(UUID.randomUUID(), "  ", null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void registersAnExternalUrlWithNoBytesUploaded() {
        UUID userId = UUID.randomUUID();
        when(mediaRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = mediaService.createExternal(userId, "https://example.com/pic.jpg", null);

        verify(s3, never()).putObject(any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class));
        assertThat(response.url()).isEqualTo("https://example.com/pic.jpg");
    }

    @Test
    void onlyTheOwnerCanDeleteMedia() {
        Media media = Media.builder().ownerId(UUID.randomUUID()).url("https://x").build();
        ReflectionTestUtils.setField(media, "id", UUID.randomUUID());
        when(mediaRepository.findByIdAndDeletedAtIsNull(media.getId())).thenReturn(Optional.of(media));

        assertThatThrownBy(() -> mediaService.delete(UUID.randomUUID(), media.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void deletingAnUploadAlsoFreesItsBytesInR2() {
        UUID userId = UUID.randomUUID();
        Media media = Media.builder().ownerId(userId).source(MediaSource.UPLOAD).storageKey("k").url("https://x").build();
        ReflectionTestUtils.setField(media, "id", UUID.randomUUID());
        when(mediaRepository.findByIdAndDeletedAtIsNull(media.getId())).thenReturn(Optional.of(media));

        mediaService.delete(userId, media.getId());

        verify(s3).deleteObject(any(DeleteObjectRequest.class));
        assertThat(media.isDeleted()).isTrue();
    }

    @Test
    void deletingAnExternalMediaNeverTouchesR2() {
        UUID userId = UUID.randomUUID();
        Media media = Media.external(userId, "https://x");
        ReflectionTestUtils.setField(media, "id", UUID.randomUUID());
        when(mediaRepository.findByIdAndDeletedAtIsNull(media.getId())).thenReturn(Optional.of(media));

        mediaService.delete(userId, media.getId());

        verify(s3, never()).deleteObject(any(DeleteObjectRequest.class));
    }
}
