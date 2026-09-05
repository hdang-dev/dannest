package com.dannest;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableScheduling powers the outbox poller (com.dannest.outbox.OutboxPoller) and,
// once it exists, the membership saga's timeout sweep.
@EnableScheduling
@SpringBootApplication
public class DannestApplication {

	public static void main(String[] args) {
		SpringApplication.run(DannestApplication.class, args);
	}

}
