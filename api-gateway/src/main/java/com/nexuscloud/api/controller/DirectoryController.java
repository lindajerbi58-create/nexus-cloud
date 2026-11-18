package com.nexuscloud.api.controller;

import com.nexuscloud.api.service.NexusService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/directories")
public class DirectoryController {

    private final NexusService service;

    public DirectoryController(NexusService service) {
        this.service = service;
    }

    public record DirectoryRequest(String path) {}

    @GetMapping
    public List<String> list()
            throws Exception {

        return service.listDirectories();
    }

    @GetMapping("/contents")
    public Map<String, Object> contents(
            @RequestParam(defaultValue = "/")
            String path
    ) throws Exception {

        return service.directoryContents(path);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @RequestBody DirectoryRequest request
    ) throws Exception {

        if (request.path() == null
                || request.path().isBlank()) {

            throw new IllegalArgumentException(
                    "Directory path is required"
            );
        }

        service.createDirectory(request.path());

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(Map.of(
                        "success", true,
                        "path", request.path()
                ));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(
            @RequestParam String path
    ) throws Exception {

        service.deleteDirectory(path);

        return ResponseEntity
                .noContent()
                .build();
    }
}