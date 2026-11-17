package com.nexuscloud.client;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.rmi.MasterService;

import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;
import java.util.List;

public class NexusClient {

    public static void main(String[] args) {

        try {

            Registry registry =
                    LocateRegistry.getRegistry("localhost", 1099);

            MasterService master =
                    (MasterService) registry.lookup("NexusMaster");

            System.out.println("[SERVER] " + master.ping());

            StorageNodeInfo testNode =
                    new StorageNodeInfo(
                            "node-test-01",
                            "localhost",
                            5001,
                            1_000_000_000L,
                            0L
                    );

            master.registerNode(testNode);

            List<StorageNodeInfo> nodes =
                    master.getStorageNodes();

            System.out.println(
                    "[INFO] Registered nodes: " + nodes.size()
            );

            for (StorageNodeInfo node : nodes) {
                System.out.println(
                        node.nodeId()
                        + " | "
                        + node.host()
                        + ":"
                        + node.port()
                );
            }

        } catch (Exception e) {
            System.err.println("[ERROR] " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}