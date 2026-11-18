package com.nexuscloud.client;

import com.nexuscloud.common.rmi.MasterService;

import java.rmi.registry.LocateRegistry;

public class DeleteFileClient {

    public static void main(String[] args) {

        if (args.length != 1) {

            System.err.println(
                    "Usage: DeleteFileClient <file-id>"
            );

            System.exit(1);
        }

        try {

            MasterService master =
                    (MasterService) LocateRegistry
                            .getRegistry("localhost", 1099)
                            .lookup("NexusMaster");

            master.deleteFile(args[0]);

            boolean exists = master.listFiles()
                    .stream()
                    .anyMatch(file ->
                            file.fileId().equals(args[0]));

            if (exists) {

                throw new IllegalStateException(
                        "File still exists in metadata"
                );
            }

            System.out.println(
                    "[SUCCESS] File logically deleted"
            );

            System.out.println(
                    "[INFO] Physical cleanup scheduled"
            );

        } catch (Exception e) {

            System.err.println(
                    "[ERROR] " + e.getMessage()
            );

            System.exit(1);
        }
    }
}