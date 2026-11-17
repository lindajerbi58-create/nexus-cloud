package com.nexuscloud.client;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.UUID;

public class StorageTestClient {

    public static void main(String[] args) {

        System.out.println("================================");
        System.out.println("    NEXUS CLOUD STORAGE TEST");
        System.out.println("================================");

        int passed = 0;

        for (int port = 5001; port <= 5003; port++) {

            System.out.println("\nTesting node on port " + port);

            try {

                testNode(port);
                passed++;

            } catch (Exception e) {

                System.err.println(
                        "[FAILED] Node " + port
                        + ": " + e.getMessage()
                );
            }
        }

        System.out.println("\n================================");
        System.out.println("Nodes passed: " + passed + "/3");
        System.out.println("================================");

        if (passed != 3) {
            System.exit(1);
        }

        System.out.println("[SUCCESS] All tests passed");
    }

    private static void testNode(int port)
            throws Exception {

        StorageClient client =
                new StorageClient("localhost", port);

        String blockId =
                "test-" + UUID.randomUUID();

        byte[] originalData =
                "Hello from Nexus Cloud!"
                        .getBytes(StandardCharsets.UTF_8);

        if (!client.ping()) {
            throw new Exception("PING failed");
        }

        System.out.println("[PASS] PING");

        client.putBlock(blockId, originalData);

        System.out.println("[PASS] PUT");

        if (!client.blockExists(blockId)) {
            throw new Exception("EXISTS failed");
        }

        System.out.println("[PASS] EXISTS");

        byte[] receivedData =
                client.getBlock(blockId);

        if (!Arrays.equals(originalData, receivedData)) {
            throw new Exception("Data integrity failed");
        }

        System.out.println("[PASS] GET");
        System.out.println("[PASS] DATA INTEGRITY");

        client.deleteBlock(blockId);

        if (client.blockExists(blockId)) {
            throw new Exception("DELETE failed");
        }

        System.out.println("[PASS] DELETE");
        System.out.println("[PASS] FINAL EXISTS CHECK");

        System.out.println("[SUCCESS] Node " + port);
    }
}