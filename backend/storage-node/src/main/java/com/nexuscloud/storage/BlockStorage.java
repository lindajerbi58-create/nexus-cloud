package com.nexuscloud.storage;

import com.nexuscloud.common.protocol.StorageProtocol;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.stream.Stream;

public class BlockStorage {

    private final Path storageDirectory;

    public BlockStorage(String directory)
            throws IOException {

        this.storageDirectory = Path.of(directory)
                .toAbsolutePath()
                .normalize();

        Files.createDirectories(storageDirectory);

        System.out.println(
                "[STORAGE] Directory: "
                + storageDirectory
        );
    }

    private Path resolveBlock(String blockId) {

        if (blockId == null
                || !blockId.matches("[a-zA-Z0-9_-]{1,128}")) {

            throw new IllegalArgumentException(
                    "Invalid block identifier"
            );
        }

        return storageDirectory.resolve(blockId + ".block");
    }

    public synchronized void storeBlock(
            String blockId,
            byte[] data
    ) throws IOException {

        if (data == null
                || data.length > StorageProtocol.DEFAULT_BLOCK_SIZE) {

            throw new IllegalArgumentException(
                    "Invalid block size"
            );
        }

        Path destination = resolveBlock(blockId);

        Path temporary = Files.createTempFile(
                storageDirectory,
                "upload-",
                ".tmp"
        );

        try {

            Files.write(temporary, data);

            Files.move(
                    temporary,
                    destination,
                    StandardCopyOption.REPLACE_EXISTING
            );

        } finally {
            Files.deleteIfExists(temporary);
        }

        System.out.println(
                "[STORAGE] Saved block: "
                + blockId
                + " (" + data.length + " bytes)"
        );
    }

    public synchronized byte[] readBlock(String blockId)
            throws IOException {

        return Files.readAllBytes(resolveBlock(blockId));
    }

    public synchronized boolean deleteBlock(String blockId)
            throws IOException {

        boolean deleted = Files.deleteIfExists(
                resolveBlock(blockId)
        );

        if (deleted) {
            System.out.println(
                    "[STORAGE] Deleted block: " + blockId
            );
        }

        return deleted;
    }

    public synchronized boolean blockExists(String blockId) {

        return Files.isRegularFile(resolveBlock(blockId));
    }

    public synchronized long getUsedCapacity()
            throws IOException {

        long total = 0;

        try (Stream<Path> paths =
                     Files.list(storageDirectory)) {

            for (Path path : paths.toList()) {

                if (Files.isRegularFile(path)
                        && path.toString().endsWith(".block")) {

                    total += Files.size(path);
                }
            }
        }

        return total;
    }

    public long getTotalCapacity() throws IOException {

        return Files.getFileStore(storageDirectory)
                .getTotalSpace();
    }

    public long getAvailableCapacity() throws IOException {

        return Files.getFileStore(storageDirectory)
                .getUsableSpace();
    }
}