package com.nexuscloud.client;

import com.nexuscloud.common.utils.ChecksumUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Random;

public class FileChunkerTest {

    public static void main(String[] args)
            throws Exception {

        Path directory = Path.of("data", "tests");

        Files.createDirectories(directory);

        Path source = directory.resolve("test-file.bin");

        Path reconstructed =
                directory.resolve("reconstructed-file.bin");

        byte[] data = new byte[2621440];

        new Random(42).nextBytes(data);

        Files.write(source, data);

        System.out.println(
                "[TEST] Original file: "
                + Files.size(source) + " bytes"
        );

        int count;

        try (var output =
                     Files.newOutputStream(reconstructed)) {

            count = FileChunker.split(
                    source,
                    (index, chunk) -> {

                        String checksum =
                                ChecksumUtils.sha256(chunk);

                        System.out.println(
                                "[SHA-256] " + checksum
                        );

                        output.write(chunk);
                    }
            );
        }

        String originalHash =
                ChecksumUtils.sha256(source);

        String reconstructedHash =
                ChecksumUtils.sha256(reconstructed);

        if (count != 3) {
            throw new IllegalStateException(
                    "Expected exactly 3 blocks"
            );
        }

        if (!originalHash.equals(reconstructedHash)) {
            throw new IllegalStateException(
                    "File integrity test failed"
            );
        }

        if (!Arrays.equals(
                Files.readAllBytes(source),
                Files.readAllBytes(reconstructed))) {

            throw new IllegalStateException(
                    "Reconstruction failed"
            );
        }

        System.out.println("[PASS] Block count: " + count);
        System.out.println("[PASS] File reconstruction");
        System.out.println("[PASS] SHA-256 verification");

        System.out.println(
                "[SUCCESS] All chunking tests passed"
        );
    }
}