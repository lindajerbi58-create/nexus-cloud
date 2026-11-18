package com.nexuscloud.client;

import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.rmi.MasterService;
import com.nexuscloud.common.utils.ChecksumUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.rmi.registry.LocateRegistry;

public class MetadataPersistenceTest {

    public static void main(String[] args)
            throws Exception {

        if (args.length != 2) {

            System.err.println(
                    "Usage: MetadataPersistenceTest "
                    + "<file-id> <original-file>"
            );

            System.exit(1);
        }

        String fileId = args[0];

        Path source = Path.of(args[1]);

        if (!Files.isRegularFile(source)) {

            throw new IllegalStateException(
                    "Original file does not exist"
            );
        }

        MasterService master =
                (MasterService) LocateRegistry
                        .getRegistry("localhost", 1099)
                        .lookup("NexusMaster");

        FileMetadata metadata =
                master.getFile(fileId);

        if (!metadata.fileId().equals(fileId)) {

            throw new IllegalStateException(
                    "File identifier mismatch"
            );
        }

        System.out.println(
                "[PASS] Metadata restored successfully"
        );

        if (metadata.fileSize() != Files.size(source)) {

            throw new IllegalStateException(
                    "File size mismatch"
            );
        }

        System.out.println(
                "[PASS] File size preserved"
        );

        String originalChecksum =
                ChecksumUtils.sha256(source);

        if (!originalChecksum.equals(metadata.checksum())) {

            throw new IllegalStateException(
                    "Metadata checksum mismatch"
            );
        }

        System.out.println(
                "[PASS] Metadata checksum preserved"
        );

        Path destination =
                Path.of(
                        "data",
                        "tests",
                        "persistent-file.bin"
                );

        Files.createDirectories(
                destination.getParent()
        );

        DistributedFileClient client =
                new DistributedFileClient(
                        "localhost",
                        1099
                );

        client.download(
                fileId,
                destination
        );

        if (!originalChecksum.equals(
                ChecksumUtils.sha256(destination))) {

            throw new IllegalStateException(
                    "Downloaded file is corrupted"
            );
        }

        System.out.println(
                "[PASS] File downloaded after restart"
        );

        System.out.println(
                "[PASS] SHA-256 integrity verified"
        );

        System.out.println(
                "[SUCCESS] Metadata persistence test passed"
        );
    }
}