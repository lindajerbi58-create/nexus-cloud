package com.nexuscloud.client;

import com.nexuscloud.common.model.NodeHealthInfo;
import com.nexuscloud.common.model.NodeStatus;
import com.nexuscloud.common.rmi.MasterService;

import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

public class ClusterStatusClient {

    public static void main(String[] args) {

        try {

            Registry registry =
                    LocateRegistry.getRegistry(
                            "localhost",
                            1099
                    );

            MasterService master =
                    (MasterService) registry.lookup(
                            "NexusMaster"
                    );

            boolean watch =
                    args.length > 0
                    && args[0].equals("--watch");

            do {

                List<NodeHealthInfo> nodes =
                        master.getNodeHealth()
                                .stream()
                                .sorted(
                                    Comparator.comparing(
                                        n -> n.node().nodeId()
                                    )
                                )
                                .toList();

                long online = nodes.stream()
                        .filter(
                            n -> n.status()
                                == NodeStatus.ONLINE
                        )
                        .count();

                System.out.println(
                        "\n======= NEXUS CLUSTER STATUS ======="
                );

                System.out.println(
                        "Timestamp: " + Instant.now()
                );

                System.out.println(
                        "Online nodes: "
                        + online + "/" + nodes.size()
                );

                for (NodeHealthInfo health : nodes) {

                    long age = Math.max(
                            0,
                            Duration.between(
                                    health.lastHeartbeat(),
                                    Instant.now()
                            ).toSeconds()
                    );

                    System.out.printf(
                            "%-10s | %-8s | Port: %d"
                            + " | Last heartbeat: %ds ago%n",

                            health.node().nodeId(),
                            health.status(),
                            health.node().port(),
                            age
                    );
                }

                System.out.println(
                        "===================================="
                );

                if (watch) {
                    Thread.sleep(2000);
                }

            } while (watch);

        } catch (Exception e) {

            System.err.println(
                    "[ERROR] " + e.getMessage()
            );

            System.exit(1);
        }
    }
}