package com.nexuscloud.common.model;

import java.io.Serializable;

public record StorageNodeInfo(
        String nodeId,
        String host,
        int port,
        long totalCapacity,
        long usedCapacity
) implements Serializable {

    private static final long serialVersionUID = 1L;

    public long getAvailableCapacity() {
        return totalCapacity - usedCapacity;
    }
}