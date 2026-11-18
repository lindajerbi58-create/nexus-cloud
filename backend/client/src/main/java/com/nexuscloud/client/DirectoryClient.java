package com.nexuscloud.client;

import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.rmi.DirectoryService;

import java.rmi.registry.LocateRegistry;
import java.util.List;

public class DirectoryClient {

    private static void printUsage() {

        System.out.println(
                "======= NEXUS DIRECTORY CLI ======="
        );

        System.out.println("mkdir <path>");

        System.out.println("rmdir <path>");

        System.out.println("folders");

        System.out.println("ls <path>");

        System.out.println("move <file-id> <directory>");

        System.out.println("location <file-id>");
    }

    private static void requireArguments(
            String[] args,
            int expected
    ) {

        if (args.length != expected) {

            throw new IllegalArgumentException(
                    "Invalid number of arguments"
            );
        }
    }

    public static void main(String[] args) {

        if (args.length == 0) {

            printUsage();

            return;
        }

        try {

            DirectoryService service =
                    (DirectoryService) LocateRegistry
                            .getRegistry("localhost", 1099)
                            .lookup("NexusDirectory");

            switch (args[0].toLowerCase()) {

                case "mkdir" -> {

                    requireArguments(args, 2);

                    service.createDirectory(args[1]);

                    System.out.println(
                            "[SUCCESS] Directory created"
                    );
                }

                case "rmdir" -> {

                    requireArguments(args, 2);

                    service.deleteDirectory(args[1]);

                    System.out.println(
                            "[SUCCESS] Directory deleted"
                    );
                }

                case "folders" -> {

                    requireArguments(args, 1);

                    System.out.println(
                            "======= DIRECTORIES ======="
                    );

                    for (String directory :
                            service.listDirectories()) {

                        System.out.println(
                                "[DIR] " + directory
                        );
                    }
                }

                case "ls" -> {

                    requireArguments(args, 2);

                    System.out.println(
                            "======= " + args[1]
                            + " ======="
                    );

                    List<String> folders =
                            service.listSubdirectories(
                                    args[1]
                            );

                    List<FileMetadata> files =
                            service.listFiles(args[1]);

                    for (String folder : folders) {

                        System.out.println(
                                "[DIR] " + folder
                        );
                    }

                    for (FileMetadata file : files) {

                        System.out.println(
                                "[FILE] "
                                + file.fileName()
                                + " | "
                                + file.fileSize()
                                + " bytes"
                                + " | ID: "
                                + file.fileId()
                        );
                    }

                    if (folders.isEmpty()
                            && files.isEmpty()) {

                        System.out.println(
                                "[INFO] Directory is empty"
                        );
                    }
                }

                case "move" -> {

                    requireArguments(args, 3);

                    service.moveFile(
                            args[1],
                            args[2]
                    );

                    System.out.println(
                            "[SUCCESS] File moved"
                    );
                }

                case "location" -> {

                    requireArguments(args, 2);

                    System.out.println(
                            "[LOCATION] "
                            + service.getFileDirectory(
                                    args[1])
                    );
                }

                default -> {

                    printUsage();

                    System.exit(1);
                }
            }

        } catch (Exception e) {

            System.err.println(
                    "[ERROR] " + e.getMessage()
            );

            System.exit(1);
        }
    }
}