package com.nexuscloud.master;

import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;

public class MasterServer {

    public static void main(String[] args) {

        try {

            System.out.println(
                    "================================"
            );

            System.out.println(
                    "       NEXUS CLOUD MASTER"
            );

            System.out.println(
                    "================================"
            );

            int port = 1099;

            Registry registry =
                    LocateRegistry.createRegistry(port);

            MasterServiceImpl master =
                    new MasterServiceImpl();

            DirectoryServiceImpl directoryService =
                    new DirectoryServiceImpl(master);

            registry.rebind(
                    "NexusMaster",
                    master
            );

            registry.rebind(
                    "NexusDirectory",
                    directoryService
            );

            System.out.println(
                    "[INFO] RMI Registry port: " + port
            );

            System.out.println(
                    "[INFO] Service: NexusMaster"
            );

            System.out.println(
                    "[INFO] Service: NexusDirectory"
            );

            System.out.println(
                    "[SUCCESS] Master server is online"
            );

            System.out.println(
                    "[INFO] Waiting for connections..."
            );

        } catch (Exception e) {

            System.err.println(
                    "[MASTER ERROR] " + e.getMessage()
            );

            e.printStackTrace();

            System.exit(1);
        }
    }
}