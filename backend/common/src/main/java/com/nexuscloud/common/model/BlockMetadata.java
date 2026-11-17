package com.nexuscloud.common.model;

import java.io.Serializable;
import java.util.List;

public record BlockMetadata(
        String blockId,
        int index,
        int size,
        String checksum,
        List<String> replicaNodeIds
) implements Serializable {

    private static final long serialVersionUID = 1L;

    public BlockMetadata {
        replicaNodeIds = List.copyOf(replicaNodeIds);
    }

    public int getReplicationCount() {
        return replicaNodeIds.size();
    }
}