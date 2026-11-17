package com.nexuscloud.client;

import com.nexuscloud.common.protocol.StorageProtocol;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public final class FileChunker {

    private FileChunker() {
    }

    @FunctionalInterface
    public interface ChunkHandler {

        void handle(int index, byte[] data)
                throws IOException;
    }

    public static int split(
            Path file,
            ChunkHandler handler
    ) throws IOException {

        int index = 0;

        try (InputStream input = Files.newInputStream(file)) {

            while (true) {

                byte[] chunk = input.readNBytes(
                        StorageProtocol.DEFAULT_BLOCK_SIZE
                );

                if (chunk.length == 0) {
                    break;
                }

                handler.handle(index, chunk);

                System.out.println(
                        "[CHUNK] Block " + index
                        + " | " + chunk.length + " bytes"
                );

                index++;
            }
        }

        return index;
    }
}