package com.nexuscloud.api.controller;

import com.nexuscloud.api.service.WorkspaceService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/directories")
public class DirectoryController {

    private final WorkspaceService workspace;

    public DirectoryController(
            WorkspaceService workspace
    ) {

        this.workspace = workspace;
    }

    public record DirectoryRequest(
            String path
    ) {}

    @GetMapping
    public List<String> list(
            @AuthenticationPrincipal Jwt jwt
    ) throws Exception {

        return workspace.listDirectories(jwt);
    }

    @GetMapping("/contents")
    public Map<String, Object> contents(

            @AuthenticationPrincipal Jwt jwt,

            @RequestParam(defaultValue = "/")
            String path

    ) throws Exception {

        return workspace.contents(jwt, path);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(

            @AuthenticationPrincipal Jwt jwt,

            @RequestBody DirectoryRequest request

    ) throws Exception {

        if (request.path() == null
                || request.path().isBlank()) {

            throw new IllegalArgumentException(
                    "Directory path is required"
            );
        }

        workspace.createDirectory(
                jwt,
                request.path()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(Map.of(
                        "success", true,
                        "path", request.path()
                ));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(

            @AuthenticationPrincipal Jwt jwt,

            @RequestParam String path

    ) throws Exception {

        workspace.deleteDirectory(jwt, path);

        return ResponseEntity
                .noContent()
                .build();
    }
}