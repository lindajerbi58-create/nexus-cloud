package com.nexuscloud.common.utils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class ChecksumUtils {

    private ChecksumUtils() {
    }

    private static MessageDigest createDigest() {

        try {
            return MessageDigest.getInstance("SHA-256");

        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(
                    "SHA-256 is unavailable", e
            );
        }
    }

    public static String sha256(byte[] data) {

        MessageDigest digest = createDigest();

        return HexFormat.of().formatHex(
                digest.digest(data)
        );
    }

    public static String sha256(Path file)
            throws IOException {

        MessageDigest digest = createDigest();

        try (InputStream input = Files.newInputStream(file)) {

            byte[] buffer = new byte[8192];

            int bytesRead;

            while ((bytesRead = input.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
        }

        return HexFormat.of().formatHex(digest.digest());
    }

    public static boolean verify(
            byte[] data,
            String expectedChecksum
    ) {

        return sha256(data).equals(expectedChecksum);
    }
}