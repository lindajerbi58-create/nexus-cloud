package com.nexuscloud.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.nexuscloud.api")
public class NexusApiApplication {

    public static void main(String[] args) {

        SpringApplication.run(
                NexusApiApplication.class,
                args
        );
    }
}