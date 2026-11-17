package com.nexuscloud.client;

import com.nexuscloud.common.model.BlockMetadata;
import com.nexuscloud.common.model.FileMetadata;

import java.nio.file.Path;

public class DistributedFileTest {

    public static void main(String[] args) {

        try {

            if (args.length == 0) {

                printUsage();
                return;
            }

            DistributedFileClient client =
                    new DistributedFileClient(
                            "localhost",
                            1099
                    );

            switch (args[0]) {

                case "upload" -> {

                    if (args.length != 2) {
                        throw new IllegalArgumentException(
                                "Upload requires a file path"
                        );
                    }

                    String fileId =
                            client.upload(Path.of(args[1]));

                    System.out.println(
                            "[FILE ID] " + fileId
                    );
                }

                case "download" -> {

                    if (args.length != 3) {
                        throw new IllegalArgumentException(
                                "Download requires ID and destination"
                        );
                    }

                    client.download(
                            args[1],
                            Path.of(args[2])
                    );
                }

                case "list" -> {

                    System.out.println(
                            "======= NEXUS CLOUD FILES ======="
                    );

                    for (FileMetadata file :
                            client.listFiles()) {

                        System.out.println(
                                "\nName: " + file.fileName()
                        );

                        System.out.println(
                                "ID: " + file.fileId()
                        );

                        System.out.println(
                                "Size: " + file.fileSize()
                                + " bytes"
                        );

                        System.out.println(
                                "Blocks: "
                                + file.getBlockCount()
                        );

                        System.out.println(
                                "Replicas: "
                                + file.getTotalReplicas()
                        );

                        for (BlockMetadata block :
                                file.blocks()) {

                            System.out.println(
                                    "Block "
                                    + block.index()
                                    + " -> "
                                    + block.replicaNodeIds()
                            );
                        }
                    }
                }

                default -> printUsage();
            }

        } catch (Exception e) {

            System.err.println(
                    "[ERROR] " + e.getMessage()
            );

            e.printStackTrace();

            System.exit(1);
        }
    }

    private static void printUsage() {

        System.out.println(
                "Commands:"
        );

        System.out.println(
                "upload <file-path>"
        );

        System.out.println(
                "download <file-id> <destination>"
        );

        System.out.println(
                "list"
        );
    }
}