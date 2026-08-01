package com.dannest.media;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cloudflare R2 settings (bound from {@code storage.r2.*} in application.yml).
 *
 * @param accountId     R2 account id — forms the S3 endpoint host.
 * @param accessKey     R2 API token access key id.
 * @param secretKey     R2 API token secret.
 * @param bucket        target bucket name.
 * @param publicBaseUrl public base URL of the bucket (r2.dev or a custom domain),
 *                      with no trailing slash; stored on each media row.
 */
@ConfigurationProperties(prefix = "storage.r2")
public record R2Properties(
        String accountId,
        String accessKey,
        String secretKey,
        String bucket,
        String publicBaseUrl) {

    /** The S3-compatible endpoint for this account. */
    public String endpoint() {
        return "https://" + accountId + ".r2.cloudflarestorage.com";
    }
}
