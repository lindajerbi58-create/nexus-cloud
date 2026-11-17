package com.nexuscloud.common.model;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;

public record FileMetadata(
        String fileId,
        String fileName,
        long fileSize,
        Instant createdAt,
        String checksum,
        List<BlockMetadata> blocks
) implements Serializable {

    private static final long serialVersionUID = 1L;

    public FileMetadata {
        blocks = List.copyOf(blocks);
    }

    public int getBlockCount() {
        return blocks.size();
    }

    public long getTotalReplicas() {

        return blocks.stream()
                .mapToLong(BlockMetadata::getReplicationCount)
                .sum();
    }
}