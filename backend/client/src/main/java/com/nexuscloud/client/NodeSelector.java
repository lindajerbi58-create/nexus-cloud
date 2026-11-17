package com.nexuscloud.client;

import com.nexuscloud.common.model.StorageNodeInfo;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class NodeSelector {

    private NodeSelector() {
    }

    public static List<StorageNodeInfo> getAvailableNodes(
            List<StorageNodeInfo> nodes
    ) {

        List<StorageNodeInfo> available =
                new ArrayList<>();

        for (StorageNodeInfo node : nodes) {

            try {

                StorageClient client =
                        new StorageClient(
                                node.host(),
                                node.port()
                        );

                if (client.ping()) {
                    available.add(node);
                }

            } catch (IOException e) {

                System.out.println(
                        "[OFFLINE] " + node.nodeId()
                );
            }
        }

        available.sort(
                Comparator.comparing(
                        StorageNodeInfo::nodeId
                )
        );

        return available;
    }

    public static List<StorageNodeInfo> selectNodes(
            List<StorageNodeInfo> nodes,
            int blockIndex,
            int replicationFactor
    ) {

        if (replicationFactor <= 0
                || nodes.size() < replicationFactor) {

            throw new IllegalArgumentException(
                    "Not enough available storage nodes"
            );
        }

        List<StorageNodeInfo> selected =
                new ArrayList<>();

        for (int i = 0; i < replicationFactor; i++) {

            int position =
                    (blockIndex + i) % nodes.size();

            selected.add(nodes.get(position));
        }

        return selected;
    }
}