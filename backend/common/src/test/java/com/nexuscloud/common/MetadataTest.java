package com.nexuscloud.common;

import com.nexuscloud.common.model.BlockMetadata;
import com.nexuscloud.common.model.FileMetadata;
import com.nexuscloud.common.protocol.StorageProtocol;
import com.nexuscloud.common.utils.ChecksumUtils;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MetadataTest {

    @TempDir
    Path temporaryDirectory;

    private BlockMetadata createBlock(
            String id,
            int index,
            int size,
            List<String> replicas
    ) {

        return new BlockMetadata(
                id,
                index,
                size,
                "test-checksum",
                replicas
        );
    }

    @Test
    void blockSizeMustBeOneMiB() {

        assertEquals(
                1024 * 1024,
                StorageProtocol.DEFAULT_BLOCK_SIZE
        );
    }

    @Test
    void replicationFactorMustBeTwo() {

        assertEquals(
                2,
                StorageProtocol.REPLICATION_FACTOR
        );
    }

    @Test
    void blockMustReportCorrectReplicaCount() {

        BlockMetadata block = createBlock(
                "block-01",
                0,
                1024,
                List.of("node-01", "node-02")
        );

        assertEquals(2, block.getReplicationCount());

        assertEquals(1024, block.size());

        assertEquals(0, block.index());
    }

    @Test
    void blockWithoutReplicasMustReportZero() {

        BlockMetadata block = createBlock(
                "block-02",
                1,
                512,
                List.of()
        );

        assertEquals(0, block.getReplicationCount());
    }

    @Test
    void replicaMetadataMustBeImmutable() {

        List<String> replicas = new ArrayList<>();

        replicas.add("node-01");

        BlockMetadata block = createBlock(
                "block-01",
                0,
                128,
                replicas
        );

        replicas.add("node-02");

        assertEquals(
                1,
                block.getReplicationCount()
        );

        assertThrows(
                UnsupportedOperationException.class,
                () -> block.replicaNodeIds().add("node-03")
        );
    }

    @Test
    void fileMustReportCorrectBlockAndReplicaCounts() {

        int blockSize =
                StorageProtocol.DEFAULT_BLOCK_SIZE;

        List<BlockMetadata> blocks = List.of(

                createBlock(
                        "block-01",
                        0,
                        blockSize,
                        List.of("node-01", "node-02")
                ),

                createBlock(
                        "block-02",
                        1,
                        blockSize,
                        List.of("node-02", "node-03")
                ),

                createBlock(
                        "block-03",
                        2,
                        blockSize / 2,
                        List.of("node-01", "node-03")
                )
        );

        FileMetadata file = new FileMetadata(
                "file-01",
                "test.bin",
                2L * blockSize + blockSize / 2,
                Instant.now(),
                "test-checksum",
                blocks
        );

        assertEquals(3, file.getBlockCount());

        assertEquals(6L, file.getTotalReplicas());

        long reconstructedSize = file.blocks()
                .stream()
                .mapToLong(BlockMetadata::size)
                .sum();

        assertEquals(
                file.fileSize(),
                reconstructedSize
        );
    }

    @Test
    void fileMustProtectItsBlockList() {

        List<BlockMetadata> blocks =
                new ArrayList<>();

        blocks.add(
                createBlock(
                        "block-01",
                        0,
                        128,
                        List.of("node-01", "node-02")
                )
        );

        FileMetadata file = new FileMetadata(
                "file-01",
                "test.bin",
                128,
                Instant.now(),
                "test-checksum",
                blocks
        );

        blocks.clear();

        assertEquals(1, file.getBlockCount());

        assertThrows(
                UnsupportedOperationException.class,
                () -> file.blocks().clear()
        );
    }

    @Test
    void sha256MustMatchKnownReference() {

        byte[] data = "abc".getBytes(
                StandardCharsets.UTF_8
        );

        String expected =
                "ba7816bf8f01cfea414140de5dae2223" +
                "b00361a396177a9cb410ff61f20015ad";

        assertEquals(
                expected,
                ChecksumUtils.sha256(data)
        );
    }

    @Test
    void identicalContentMustPassIntegrityVerification() {

        byte[] data = "NEXUS DATA".getBytes(
                StandardCharsets.UTF_8
        );

        String checksum =
                ChecksumUtils.sha256(data);

        assertTrue(
                ChecksumUtils.verify(data, checksum)
        );
    }

    @Test
    void modifiedContentMustFailIntegrityVerification() {

        byte[] original = "NEXUS DATA".getBytes(
                StandardCharsets.UTF_8
        );

        String checksum =
                ChecksumUtils.sha256(original);

        byte[] corrupted = original.clone();

        corrupted[0] ^= 1;

        assertFalse(
                ChecksumUtils.verify(
                        corrupted,
                        checksum
                )
        );
    }

    @Test
    void fileAndByteArrayMustProduceSameChecksum()
            throws Exception {

        byte[] data = "Distributed storage test"
                .getBytes(StandardCharsets.UTF_8);

        Path file = temporaryDirectory.resolve(
                "checksum-test.bin"
        );

        Files.write(file, data);

        assertEquals(
                ChecksumUtils.sha256(data),
                ChecksumUtils.sha256(file)
        );
    }
}