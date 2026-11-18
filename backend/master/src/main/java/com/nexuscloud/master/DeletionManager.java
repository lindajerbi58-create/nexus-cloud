package com.nexuscloud.master;

import com.nexuscloud.common.model.BlockMetadata;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.model.NodeHealthInfo;
import com.nexuscloud.common.model.NodeStatus;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

public class DeletionManager {

    private final Path directory;

    private final BlockTransferClient transfer =
            new BlockTransferClient();

    private final Map<String, List<String>> tombstones =
            new HashMap<>();

    public DeletionManager(Path directory)
            throws IOException {

        this.directory = directory;

        Files.createDirectories(directory);

        try (var paths = Files.list(directory)) {

            for (Path path : paths.toList()) {

                String name =
                        path.getFileName().toString();

                if (!name.endsWith(".deleted")) {
                    continue;
                }

                String fileId = name.substring(
                        0, name.length() - 8
                );

                tombstones.put(
                        fileId,
                        List.copyOf(Files.readAllLines(path))
                );
            }
        }
    }

    public synchronized boolean isDeleted(
            String fileId
    ) {

        return tombstones.containsKey(fileId);
    }

    public synchronized void markDeleted(
            FileMetadata file
    ) throws IOException {

        if (isDeleted(file.fileId())) {
            return;
        }

        if (!file.fileId().matches("[a-zA-Z0-9_-]{1,128}")) {

            throw new IOException("Invalid file identifier");
        }

        List<String> blocks = file.blocks()
                .stream()
                .map(BlockMetadata::blockId)
                .toList();

        Path target = directory.resolve(
                file.fileId() + ".deleted"
        );

        Path temporary = Files.createTempFile(
                directory,
                "deletion-",
                ".tmp"
        );

        try {

            Files.write(temporary, blocks);

            try (FileChannel channel = FileChannel.open(
                    temporary,
                    StandardOpenOption.WRITE)) {

                channel.force(true);
            }

            Files.move(
                    temporary,
                    target,
                    StandardCopyOption.ATOMIC_MOVE
            );

            tombstones.put(file.fileId(), blocks);

            System.out.println(
                    "[TOMBSTONE] Created for "
                    + file.fileId()
            );

        } finally {

            Files.deleteIfExists(temporary);
        }
    }

    public void cleanup(
            List<NodeHealthInfo> nodes
    ) {

        Map<String, List<String>> snapshot;

        synchronized (this) {

            snapshot = new HashMap<>(tombstones);
        }

        for (List<String> blocks : snapshot.values()) {

            for (NodeHealthInfo health : nodes) {

                if (health.status() != NodeStatus.ONLINE) {
                    continue;
                }

                for (String blockId : blocks) {

                    try {

                        if (transfer.blockExists(
                                health.node(), blockId)) {

                            transfer.deleteBlock(
                                    health.node(),
                                    blockId
                            );

                            System.out.println(
                                    "[CLEANUP] Deleted "
                                    + blockId
                                    + " from "
                                    + health.node().nodeId()
                            );
                        }

                    } catch (IOException e) {

                        System.err.println(
                                "[CLEANUP RETRY] "
                                + health.node().nodeId()
                                + " | "
                                + e.getMessage()
                        );
                    }
                }
            }
        }
    }
}