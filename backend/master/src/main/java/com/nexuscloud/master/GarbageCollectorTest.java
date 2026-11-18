package com.nexuscloud.master;

import com.nexuscloud.common.model.BlockMetadata;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.utils.ChecksumUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public class GarbageCollectorTest {

    private static void require(
            boolean condition,
            String message
    ) {

        if (!condition) {

            throw new IllegalStateException(message);
        }

        System.out.println("[PASS] " + message);
    }

    public static void main(String[] args)
            throws Exception {

        Path data = Files.createTempDirectory(
                "nexus-gc-test-"
        );

        try {

            Path node1 = data.resolve("node-01");

            Path node2 = data.resolve("node-02");

            Files.createDirectories(node1);
            Files.createDirectories(node2);

            String validId = "valid-file-0";

            String orphanId = "orphan-file-0";

            byte[] content = "NEXUS CLOUD".getBytes(
                    java.nio.charset.StandardCharsets.UTF_8
            );

            Path validBlock1 =
                    node1.resolve(validId + ".block");

            Path validBlock2 =
                    node2.resolve(validId + ".block");

            Path orphanBlock =
                    node1.resolve(orphanId + ".block");

            Files.write(validBlock1, content);
            Files.write(validBlock2, content);
            Files.write(orphanBlock, content);

            BlockMetadata block =
                    new BlockMetadata(
                            validId,
                            0,
                            content.length,
                            ChecksumUtils.sha256(content),
                            List.of("node-01", "node-02")
                    );

            FileMetadata file =
                    new FileMetadata(
                            "valid-file",
                            "test.txt",
                            content.length,
                            Instant.now(),
                            ChecksumUtils.sha256(content),
                            List.of(block)
                    );

            Map<String, FileMetadata> metadata =
                    Map.of(file.fileId(), file);

            GarbageCollector collector =
                    new GarbageCollector();

            System.out.println(
                    "======= GARBAGE COLLECTOR TEST ======="
            );

            var orphans = collector.scan(
                    data,
                    metadata
            );

            require(
                    orphans.size() == 1,
                    "Exactly one orphan detected"
            );

            require(
                    orphans.get(0).path()
                            .equals(orphanBlock),
                    "Correct orphan identified"
            );

            require(
                    Files.exists(orphanBlock),
                    "Dry run does not modify blocks"
            );

            Path quarantine =
                    collector.quarantine(
                            data,
                            orphans
                    );

            require(
                    !Files.exists(orphanBlock),
                    "Orphan removed from storage node"
            );

            require(
                    Files.exists(
                            quarantine.resolve(
                                    "node-01/" + orphanId
                                    + ".block"
                            )
                    ),
                    "Orphan preserved in quarantine"
            );

            require(
                    Files.exists(validBlock1),
                    "First valid replica preserved"
            );

            require(
                    Files.exists(validBlock2),
                    "Second valid replica preserved"
            );

            require(
                    ChecksumUtils.verify(
                            Files.readAllBytes(validBlock1),
                            block.checksum()
                    ),
                    "First replica integrity preserved"
            );

            require(
                    ChecksumUtils.verify(
                            Files.readAllBytes(validBlock2),
                            block.checksum()
                    ),
                    "Second replica integrity preserved"
            );

            require(
                    collector.scan(data, metadata)
                            .isEmpty(),
                    "No remaining orphan blocks"
            );

            System.out.println(
                    "[SUCCESS] Garbage collector test passed"
            );

        } finally {

            try (var paths = Files.walk(data)) {

                for (Path path : paths
                        .sorted(Comparator.reverseOrder())
                        .toList()) {

                    Files.deleteIfExists(path);
                }
            }
        }
    }
}