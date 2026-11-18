package com.nexuscloud.api.service;

import com.nexuscloud.common.model.FileMetadata;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class UploadJourneyService {

    private static final int MAX_OPERATIONS = 500;

    private static final long RETENTION_SECONDS = 3600;

    private final WorkspaceService workspace;

    private final UserService users;

    private final Map<String, Operation> operations =
            new HashMap<>();

    public UploadJourneyService(
            WorkspaceService workspace,
            UserService users
    ) {
        this.workspace = workspace;
        this.users = users;
    }

    public record JourneyEvent(
            String stage,
            String message,
            Instant timestamp
    ) {}

    public record JourneySnapshot(
            String id,
            String status,
            String fileName,
            long fileSize,
            Instant createdAt,
            long elapsedMs,
            List<JourneyEvent> events,
            FileMetadata file,
            String error
    ) {}

    private static class Operation {

        private final String id =
                UUID.randomUUID().toString();

        private final String owner;

        private final Instant createdAt =
                Instant.now();

        private final long startedNanos =
                System.nanoTime();

        private final List<JourneyEvent> events =
                new ArrayList<>();

        private String status = "CREATED";

        private String fileName = "";

        private long fileSize;

        private FileMetadata file;

        private String error;

        private Instant finishedAt;

        private long finishedNanos;

        private Operation(String owner) {
            this.owner = owner;
        }

        private void event(
                String stage,
                String message
        ) {

            events.add(
                    new JourneyEvent(
                            stage,
                            message,
                            Instant.now()
                    )
            );
        }

        private JourneySnapshot snapshot() {

            long end = finishedAt == null
                    ? System.nanoTime()
                    : finishedNanos;

            long elapsed =
                    (end - startedNanos) / 1_000_000;

            return new JourneySnapshot(
                    id,
                    status,
                    fileName,
                    fileSize,
                    createdAt,
                    elapsed,
                    List.copyOf(events),
                    file,
                    error
            );
        }
    }

    private String owner(Jwt jwt) {

        return users.findById(
                jwt.getSubject()
        ).id();
    }

    private synchronized void cleanup() {

        Instant now = Instant.now();

        operations.values().removeIf(op -> {

            Instant reference = op.finishedAt;

            if ("CREATED".equals(op.status)) {
                reference = op.createdAt;
            }

            return reference != null
                    && reference.plusSeconds(
                            RETENTION_SECONDS
                    ).isBefore(now);
        });
    }

    private Operation requireOperation(
            Jwt jwt,
            String id
    ) {

        Operation operation = operations.get(id);

        if (operation == null
                || !operation.owner.equals(owner(jwt))) {

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Upload operation not found"
            );
        }

        return operation;
    }

    public synchronized JourneySnapshot create(
            Jwt jwt
    ) {

        cleanup();

        if (operations.size() >= MAX_OPERATIONS) {

            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Too many tracked upload operations"
            );
        }

        Operation operation =
                new Operation(owner(jwt));

        operation.event(
                "CREATED",
                "Upload operation initialized"
        );

        operations.put(
                operation.id,
                operation
        );

        return operation.snapshot();
    }

    public synchronized JourneySnapshot get(
            Jwt jwt,
            String id
    ) {

        cleanup();

        return requireOperation(jwt, id)
                .snapshot();
    }

    public JourneySnapshot upload(
            Jwt jwt,
            String id,
            MultipartFile multipartFile,
            String directory
    ) throws Exception {

        Operation operation;

        synchronized (this) {

            operation = requireOperation(jwt, id);

            if (!"CREATED".equals(operation.status)) {

                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Operation already started"
                );
            }

            operation.fileName =
                    multipartFile.getOriginalFilename() == null
                            ? "unnamed-file"
                            : multipartFile.getOriginalFilename();

            operation.fileSize =
                    multipartFile.getSize();

            operation.status = "PROCESSING";

            operation.event(
                    "RECEIVED",
                    "Multipart file received by API Gateway"
            );

            operation.event(
                    "PROCESSING",
                    "Distributed storage operation started"
            );
        }

        try {

            FileMetadata metadata = workspace.upload(
                    jwt,
                    multipartFile,
                    directory
            );

            synchronized (this) {

                operation.file = metadata;

                int blockCount =
                        metadata.blocks().size();

                int replicaCount =
                        metadata.blocks()
                                .stream()
                                .mapToInt(block ->
                                        block.replicaNodeIds().size()
                                )
                                .sum();

                operation.event(
                        "BLOCK_METADATA",
                        blockCount
                                + " block(s) registered"
                );

                operation.event(
                        "REPLICA_METADATA",
                        replicaCount
                                + " replica location(s) registered"
                );

                operation.event(
                        "CHECKSUM",
                        "File SHA-256 recorded: "
                                + metadata.checksum()
                );

                operation.event(
                        "COMPLETED",
                        "Storage and workspace assignment confirmed"
                );

                operation.status = "COMPLETED";

                operation.finishedAt = Instant.now();

                operation.finishedNanos =
                        System.nanoTime();

                return operation.snapshot();
            }

        } catch (Exception exception) {

            synchronized (this) {

                operation.status = "FAILED";

                operation.error =
                        "Distributed upload failed";

                operation.event(
                        "FAILED",
                        operation.error
                );

                operation.finishedAt = Instant.now();

                operation.finishedNanos =
                        System.nanoTime();
            }

            throw exception;
        }
    }
}