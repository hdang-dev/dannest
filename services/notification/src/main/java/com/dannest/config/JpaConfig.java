package com.dannest.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/** Enables @CreatedDate / @LastModifiedDate auditing on BaseEntity. */
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
