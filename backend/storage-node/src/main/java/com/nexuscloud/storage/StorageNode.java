package com.nexuscloud.storage;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.rmi.MasterService;

import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;

public class StorageNode {

    public static void main(String[] args) {

        if (args.length != 3) {

            System.err.println(
                    "Usage: StorageNode <nodeId> <port> <directory>"
            );

            System.exit(1);
        }

        try {

            String nodeId = args[0];
            int port = Integer.parseInt(args[1]);
            String directory = args[2];

            BlockStorage storage =
                    new BlockStorage(directory);

            try (StorageServer server =
                         new StorageServer(port, storage)) {

                Registry registry =
                        LocateRegistry.getRegistry(
                                "localhost",
                                1099
                        );

                MasterService master =
                        (MasterService) registry.lookup(
                                "NexusMaster"
                        );

                StorageNodeInfo nodeInfo =
                        new StorageNodeInfo(
                                nodeId,
                                "localhost",
                                port,
                                storage.getTotalCapacity(),
                                storage.getUsedCapacity()
                        );

                master.registerNode(nodeInfo);

                System.out.println(
                        "================================"
                );

                System.out.println(
                        "      NEXUS STORAGE NODE"
                );

                System.out.println(
                        "================================"
                );

                System.out.println("[NODE] ID: " + nodeId);
                System.out.println("[NODE] Port: " + port);

                System.out.println(
                        "[SUCCESS] Registered with master"
                );

                server.start();
            }

        } catch (Exception e) {

            System.err.println(
                    "[ERROR] " + e.getMessage()
            );

            e.printStackTrace();

            System.exit(1);
        }
    }
}