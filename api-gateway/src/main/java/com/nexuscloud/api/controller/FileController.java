package com.nexuscloud.api.controller;

import com.nexuscloud.api.service.WorkspaceService;
import com.nexuscloud.common.model.FileMetadata;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final WorkspaceService workspace;

    public FileController(
            WorkspaceService workspace
    ) {
        this.workspace = workspace;
    }

    @GetMapping
    public List<FileMetadata> list(
            @AuthenticationPrincipal Jwt jwt
    ) throws Exception {

        return workspace.listFiles(jwt);
    }

    @GetMapping("/{id}")
    public FileMetadata details(

            @AuthenticationPrincipal Jwt jwt,

            @PathVariable String id

    ) throws Exception {

        return workspace.getFile(jwt, id);
    }

    @PostMapping(
            value = "/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<FileMetadata> upload(

            @AuthenticationPrincipal Jwt jwt,

            @RequestParam("file")
            MultipartFile file,

            @RequestParam(
                    value = "directory",
                    defaultValue = "/"
            )
            String directory

    ) throws Exception {

        FileMetadata metadata =
                workspace.upload(
                        jwt,
                        file,
                        directory
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(metadata);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(

            @AuthenticationPrincipal Jwt jwt,

            @PathVariable String id

    ) throws Exception {

        WorkspaceService.DownloadResult result =
                workspace.download(jwt, id);

        byte[] data = result.content();

        ContentDisposition disposition =
                ContentDisposition.attachment()
                        .filename(
                            result.metadata().fileName(),
                            StandardCharsets.UTF_8
                        )
                        .build();

        return ResponseEntity.ok()

                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )

                .contentType(
                        MediaType.APPLICATION_OCTET_STREAM
                )

                .contentLength(data.length)

                .body(data);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(

            @AuthenticationPrincipal Jwt jwt,

            @PathVariable String id

    ) throws Exception {

        workspace.deleteFile(jwt, id);

        return ResponseEntity
                .noContent()
                .build();
    }

    public record MoveRequest(
            String directory
    ) {}

    @PutMapping("/{id}/move")
    public Map<String, Object> move(

            @AuthenticationPrincipal Jwt jwt,

            @PathVariable String id,

            @RequestBody MoveRequest request

    ) throws Exception {

        if (request.directory() == null
                || request.directory().isBlank()) {

            throw new IllegalArgumentException(
                    "Directory is required"
            );
        }

        workspace.moveFile(
                jwt,
                id,
                request.directory()
        );

        return Map.of(
                "success", true,
                "fileId", id,
                "directory", request.directory()
        );
    }
}