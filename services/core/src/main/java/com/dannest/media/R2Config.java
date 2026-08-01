package com.dannest.media;

import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

/** Builds the S3 client that talks to Cloudflare R2. */
@Configuration
@EnableConfigurationProperties(R2Properties.class)
public class R2Config {

    private static final Logger log = LoggerFactory.getLogger(R2Config.class);

    // Placeholder used when R2 isn't configured, so the app can still boot for
    // non-upload work. The AWS SDK refuses to build a client with blank credentials.
    private static final String UNCONFIGURED = "unconfigured";

    @Bean
    S3Client s3Client(R2Properties props) {
        boolean configured = isSet(props.accessKey()) && isSet(props.secretKey()) && isSet(props.accountId());
        if (!configured) {
            // Don't fail startup — only actual uploads need R2. Warn loudly instead.
            log.warn("Cloudflare R2 is not configured (storage.r2.* / R2_* env vars are blank). "
                    + "The app will run, but image uploads will fail until they are set.");
        }

        String endpoint = isSet(props.accountId())
                ? props.endpoint()
                : "https://" + UNCONFIGURED + ".r2.cloudflarestorage.com";
        String accessKey = isSet(props.accessKey()) ? props.accessKey() : UNCONFIGURED;
        String secretKey = isSet(props.secretKey()) ? props.secretKey() : UNCONFIGURED;

        return S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                // R2 ignores the region but the SDK requires one; "auto" is the R2 convention.
                .region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .build();
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }
}
