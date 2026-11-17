package com.nexuscloud.storage;

import com.nexuscloud.common.protocol.StorageProtocol;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.Socket;

public class ClientHandler implements Runnable {

    private final Socket socket;
    private final BlockStorage storage;

    public ClientHandler(
            Socket socket,
            BlockStorage storage
    ) {
        this.socket = socket;
        this.storage = storage;
    }

    @Override
    public void run() {

        try (
                Socket connection = socket;

                DataInputStream input =
                        new DataInputStream(
                                connection.getInputStream()
                        );

                DataOutputStream output =
                        new DataOutputStream(
                                connection.getOutputStream()
                        )
        ) {

            connection.setSoTimeout(
                    StorageProtocol.SOCKET_TIMEOUT
            );

            String command = input.readUTF();

            try {

                switch (command) {

                    case StorageProtocol.PUT ->
                            handlePut(input, output);

                    case StorageProtocol.GET ->
                            handleGet(input, output);

                    case StorageProtocol.DELETE ->
                            handleDelete(input, output);

                    case StorageProtocol.EXISTS ->
                            handleExists(input, output);

                    case StorageProtocol.PING ->
                            output.writeUTF(StorageProtocol.OK);

                    default -> sendError(
                            output,
                            "Unknown command"
                    );
                }

            } catch (IllegalArgumentException | IOException e) {

                sendError(output, e.getMessage());

            }

            output.flush();

        } catch (IOException e) {

            System.err.println(
                    "[TCP ERROR] " + e.getMessage()
            );
        }
    }

    private void handlePut(
            DataInputStream input,
            DataOutputStream output
    ) throws IOException {

        String blockId = input.readUTF();
        int size = input.readInt();

        if (size < 0
                || size > StorageProtocol.DEFAULT_BLOCK_SIZE) {

            sendError(output, "Invalid block size");
            return;
        }

        byte[] data = new byte[size];

        input.readFully(data);

        storage.storeBlock(blockId, data);

        output.writeUTF(StorageProtocol.OK);
    }

    private void handleGet(
            DataInputStream input,
            DataOutputStream output
    ) throws IOException {

        String blockId = input.readUTF();

        if (!storage.blockExists(blockId)) {

            sendError(output, "Block not found");
            return;
        }

        byte[] data = storage.readBlock(blockId);

        output.writeUTF(StorageProtocol.OK);
        output.writeInt(data.length);
        output.write(data);
    }

    private void handleDelete(
            DataInputStream input,
            DataOutputStream output
    ) throws IOException {

        String blockId = input.readUTF();

        if (storage.deleteBlock(blockId)) {

            output.writeUTF(StorageProtocol.OK);

        } else {

            sendError(output, "Block not found");
        }
    }

    private void handleExists(
            DataInputStream input,
            DataOutputStream output
    ) throws IOException {

        String blockId = input.readUTF();

        output.writeUTF(StorageProtocol.OK);
        output.writeBoolean(
                storage.blockExists(blockId)
        );
    }

    private void sendError(
            DataOutputStream output,
            String message
    ) throws IOException {

        output.writeUTF(StorageProtocol.ERROR);

        output.writeUTF(
                message == null ? "Unknown error" : message
        );
    }
}