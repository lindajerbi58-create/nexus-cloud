package com.nexuscloud.master;

import com.nexuscloud.common.model.BlockMetadata;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.model.NodeHealthInfo;
import com.nexuscloud.common.model.NodeStatus;
import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.protocol.StorageProtocol;
import com.nexuscloud.common.utils.ChecksumUtils;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public class ReplicationManager {

    private final BlockTransferClient transfer =
            new BlockTransferClient();

    public void repair(
            Map<String, FileMetadata> files,
            List<NodeHealthInfo> health
    ) {

        List<StorageNodeInfo> onlineNodes =
                health.stream()
                        .filter(node ->
                                node.status() == NodeStatus.ONLINE)
                        .map(NodeHealthInfo::node)
                        .sorted(Comparator.comparing(
                                StorageNodeInfo::nodeId))
                        .toList();

        for (FileMetadata file : files.values()) {

            List<BlockMetadata> updatedBlocks =
                    new ArrayList<>();

            for (BlockMetadata block : file.blocks()) {

                BlockMetadata updated =
                        repairBlock(block, onlineNodes);

                updatedBlocks.add(updated);
            }

            if (!updatedBlocks.equals(file.blocks())) {

                FileMetadata updatedFile =
                        new FileMetadata(
                                file.fileId(),
                                file.fileName(),
                                file.fileSize(),
                                file.createdAt(),
                                file.checksum(),
                                updatedBlocks
                        );

                if (files.replace(
                        file.fileId(),
                        file,
                        updatedFile)) {

                    System.out.println(
                            "[HEALING] Metadata updated: "
                            + file.fileName()
                    );
                }
            }
        }
    }

    private BlockMetadata repairBlock(
            BlockMetadata block,
            List<StorageNodeInfo> onlineNodes
    ) {

        List<String> validReplicas =
                new ArrayList<>();

        byte[] validData = null;

        int required =
                StorageProtocol.REPLICATION_FACTOR;

        long onlineReplicas = onlineNodes.stream()
                .filter(node ->
                        block.replicaNodeIds()
                                .contains(node.nodeId()))
                .count();

        if (onlineReplicas >= required) {
            return block;
        }

        System.out.println(
                "[UNDER-REPLICATED] Block "
                + block.blockId()
                + " | Available: "
                + onlineReplicas
                + "/" + required
        );

        for (StorageNodeInfo node : onlineNodes) {

            if (!block.replicaNodeIds()
                    .contains(node.nodeId())) {
                continue;
            }

            try {

                byte[] data = transfer.getBlock(
                        node,
                        block.blockId()
                );

                if (data.length == block.size()
                        && ChecksumUtils.verify(
                                data,
                                block.checksum())) {

                    validReplicas.add(node.nodeId());
                    validData = data;
                }

            } catch (IOException e) {

                System.err.println(
                        "[HEALING ERROR] "
                        + e.getMessage()
                );
            }
        }

        if (validData == null) {

            System.err.println(
                    "[CRITICAL] No accessible valid replica: "
                    + block.blockId()
            );

            return block;
        }

        for (StorageNodeInfo target : onlineNodes) {

            if (validReplicas.size() >= required) {
                break;
            }

            if (validReplicas.contains(target.nodeId())) {
                continue;
            }

            try {

                transfer.putBlock(
                        target,
                        block.blockId(),
                        validData
                );

                byte[] verification = transfer.getBlock(
                        target,
                        block.blockId()
                );

                if (verification.length != block.size()
                        || !ChecksumUtils.verify(
                                verification,
                                block.checksum())) {

                    throw new IOException(
                            "Replica integrity check failed"
                    );
                }

                validReplicas.add(target.nodeId());

                System.out.println(
                        "[HEALING] Block "
                        + block.index()
                        + " replicated to "
                        + target.nodeId()
                );

            } catch (IOException e) {

                System.err.println(
                        "[HEALING ERROR] "
                        + e.getMessage()
                );
            }
        }

        if (validReplicas.size() < required) {

            System.out.println(
                    "[WARNING] Replication incomplete: "
                    + block.blockId()
            );

            return block;
        }

        System.out.println(
                "[SUCCESS] Replication restored for "
                + block.blockId()
        );

        return new BlockMetadata(
                block.blockId(),
                block.index(),
                block.size(),
                block.checksum(),
                validReplicas
        );
    }
}