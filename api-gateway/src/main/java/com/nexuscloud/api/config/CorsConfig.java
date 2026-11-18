package com.nexuscloud.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${nexus.frontend.origin}")
    private String frontendOrigin;

    @Override
    public void addCorsMappings(
            CorsRegistry registry
    ) {

        registry.addMapping("/api/**")
                .allowedOrigins(frontendOrigin)
                .allowedMethods(
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"
                )
                .allowedHeaders(
                        "Authorization",
                        "Content-Type"
                )
                .exposedHeaders(
                        "Content-Disposition"
                )
                .maxAge(3600);
    }
}