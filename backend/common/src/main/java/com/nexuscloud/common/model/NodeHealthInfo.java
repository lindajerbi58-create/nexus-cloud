package com.nexuscloud.common.model;

import java.io.Serializable;
import java.time.Instant;

public record NodeHealthInfo(
        StorageNodeInfo node,
        NodeStatus status,
        Instant lastHeartbeat
) implements Serializable {

    private static final long serialVersionUID = 1L;
}