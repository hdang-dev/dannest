package com.dannest.media;

/** How a media asset is stored. */
public enum MediaSource {
    /** Bytes uploaded to our storage (Cloudflare R2). */
    UPLOAD,
    /** An external image link — no bytes stored, just referenced. */
    EXTERNAL,
}
