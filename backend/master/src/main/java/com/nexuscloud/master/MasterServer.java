package com.nexuscloud.master;

import com.nexuscloud.common.rmi.MasterService;
import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;

public class MasterServer {

    public static void main(String[] args) {

        try {
            int port = 1099;

            Registry registry =
                    LocateRegistry.createRegistry(port);

            MasterService masterService =
                    new MasterServiceImpl();

            registry.rebind("NexusMaster", masterService);

            System.out.println("================================");
            System.out.println("       NEXUS CLOUD MASTER");
            System.out.println("================================");
            System.out.println("[INFO] RMI Registry port: " + port);
            System.out.println("[INFO] Service: NexusMaster");
            System.out.println("[SUCCESS] Master server is online");
            System.out.println("[INFO] Waiting for connections...");

        } catch (Exception e) {
            System.err.println("[ERROR] " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}