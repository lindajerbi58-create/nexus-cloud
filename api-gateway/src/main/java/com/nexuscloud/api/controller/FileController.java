package com.nexuscloud.api.controller;

import com.nexuscloud.api.service.NexusService;
import com.nexuscloud.common.model.FileMetadata;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final NexusService service;

    public FileController(
            NexusService service
    ) {

        this.service = service;
    }

    @GetMapping
    public List<FileMetadata> list()
            throws Exception {

        return service.listFiles();
    }

    @GetMapping("/{id}")
    public FileMetadata details(
            @PathVariable String id
    ) throws Exception {

        return service.getFile(id);
    }

    @PostMapping(
            value = "/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<FileMetadata> upload(

            @RequestParam("file")
            MultipartFile file,

            @RequestParam(
                    value = "directory",
                    defaultValue = "/"
            )
            String directory

    ) throws Exception {

        FileMetadata metadata =
                service.upload(file, directory);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(metadata);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(
            @PathVariable String id
    ) throws Exception {

        FileMetadata metadata =
                service.getFile(id);

        byte[] data = service.download(id);

        ContentDisposition disposition =
                ContentDisposition.attachment()
                        .filename(
                                metadata.fileName(),
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
            @PathVariable String id
    ) throws Exception {

        service.deleteFile(id);

        return ResponseEntity
                .noContent()
                .build();
    }

    public record MoveRequest(
            String directory
    ) {}

    @PutMapping("/{id}/move")
    public Map<String, Object> move(

            @PathVariable String id,

            @RequestBody MoveRequest request

    ) throws Exception {

        service.moveFile(
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