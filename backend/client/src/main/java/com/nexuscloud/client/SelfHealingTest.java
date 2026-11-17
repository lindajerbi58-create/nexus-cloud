package com.nexuscloud.client;

import com.nexuscloud.common.model.BlockMetadata;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.model.NodeHealthInfo;
import com.nexuscloud.common.model.NodeStatus;
import com.nexuscloud.common.protocol.StorageProtocol;
import com.nexuscloud.common.rmi.MasterService;
import com.nexuscloud.common.utils.ChecksumUtils;

import java.rmi.registry.LocateRegistry;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class SelfHealingTest {

    public static void main(String[] args)
            throws Exception {

        if (args.length != 1) {

            System.err.println(
                    "Usage: SelfHealingTest <file-id>"
            );

            System.exit(1);
        }

        MasterService master =
                (MasterService) LocateRegistry
                        .getRegistry("localhost", 1099)
                        .lookup("NexusMaster");

        FileMetadata file = master.getFile(args[0]);

        List<NodeHealthInfo> nodes =
                master.getNodeHealth();

        boolean offlineDetected = nodes.stream()
                .anyMatch(node ->
                        node.node().nodeId().equals("node-01")
                        && node.status() == NodeStatus.OFFLINE);

        if (!offlineDetected) {

            throw new IllegalStateException(
                    "Node 01 must be offline for this test"
            );
        }

        if (file.blocks().isEmpty()) {

            throw new IllegalStateException(
                    "Test requires a non-empty file"
            );
        }

        System.out.println(
                "======= SELF-HEALING TEST ======="
        );

        for (BlockMetadata block : file.blocks()) {

            Set<String> verifiedNodes =
                    new HashSet<>();

            for (String nodeId : block.replicaNodeIds()) {

                for (NodeHealthInfo health : nodes) {

                    if (!health.node().nodeId().equals(nodeId)
                            || health.status() != NodeStatus.ONLINE) {

                        continue;
                    }

                    StorageClient client =
                            new StorageClient(
                                    health.node().host(),
                                    health.node().port()
                            );

                    byte[] data =
                            client.getBlock(block.blockId());

                    if (data.length != block.size()
                            || !ChecksumUtils.verify(
                                    data,
                                    block.checksum())) {

                        throw new IllegalStateException(
                                "Corrupted replica on "
                                + nodeId
                        );
                    }

                    verifiedNodes.add(nodeId);
                }
            }

            if (verifiedNodes.size()
                    < StorageProtocol.REPLICATION_FACTOR) {

                throw new IllegalStateException(
                        "Replication not restored for block "
                        + block.index()
                );
            }

            System.out.println(
                    "[PASS] Block "
                    + block.index()
                    + " | Valid replicas: "
                    + verifiedNodes
            );
        }

        System.out.println(
                "[PASS] Node 01 is offline"
        );

        System.out.println(
                "[PASS] All blocks have valid replicas"
        );

        System.out.println(
                "[SUCCESS] Self-healing test passed"
        );
    }
}