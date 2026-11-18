package com.nexuscloud.master;

import com.nexuscloud.common.model.StorageNodeInfo;
import com.nexuscloud.common.protocol.StorageProtocol;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;

public class BlockTransferClient {

    private Socket connect(StorageNodeInfo node)
            throws IOException {

        Socket socket = new Socket();

        try {

            socket.connect(
                    new InetSocketAddress(
                            node.host(),
                            node.port()
                    ),
                    StorageProtocol.SOCKET_TIMEOUT
            );

            socket.setSoTimeout(
                    StorageProtocol.SOCKET_TIMEOUT
            );

            return socket;

        } catch (IOException e) {

            socket.close();
            throw e;
        }
    }

    private void checkResponse(DataInputStream input)
            throws IOException {

        String status = input.readUTF();

        if (StorageProtocol.ERROR.equals(status)) {
            throw new IOException(input.readUTF());
        }

        if (!StorageProtocol.OK.equals(status)) {
            throw new IOException("Unexpected response");
        }
    }

    public byte[] getBlock(
            StorageNodeInfo node,
            String blockId
    ) throws IOException {

        try (
                Socket socket = connect(node);

                DataInputStream input =
                        new DataInputStream(
                                socket.getInputStream()
                        );

                DataOutputStream output =
                        new DataOutputStream(
                                socket.getOutputStream()
                        )
        ) {

            output.writeUTF(StorageProtocol.GET);
            output.writeUTF(blockId);
            output.flush();

            checkResponse(input);

            int size = input.readInt();

            if (size < 0
                    || size > StorageProtocol.DEFAULT_BLOCK_SIZE) {

                throw new IOException("Invalid block size");
            }

            byte[] data = new byte[size];

            input.readFully(data);

            return data;
        }
    }

    public void putBlock(
            StorageNodeInfo node,
            String blockId,
            byte[] data
    ) throws IOException {

        if (data == null
                || data.length > StorageProtocol.DEFAULT_BLOCK_SIZE) {

            throw new IOException("Invalid block data");
        }

        try (
                Socket socket = connect(node);

                DataInputStream input =
                        new DataInputStream(
                                socket.getInputStream()
                        );

                DataOutputStream output =
                        new DataOutputStream(
                                socket.getOutputStream()
                        )
        ) {

            output.writeUTF(StorageProtocol.PUT);
            output.writeUTF(blockId);
            output.writeInt(data.length);
            output.write(data);
            output.flush();

            checkResponse(input);
        }
    }
    public boolean blockExists(
        StorageNodeInfo node,
        String blockId
) throws IOException {

    try (
            Socket socket = connect(node);
            DataInputStream input =
                    new DataInputStream(socket.getInputStream());
            DataOutputStream output =
                    new DataOutputStream(socket.getOutputStream())
    ) {

        output.writeUTF(StorageProtocol.EXISTS);
        output.writeUTF(blockId);
        output.flush();

        checkResponse(input);

        return input.readBoolean();
    }
}

public void deleteBlock(
        StorageNodeInfo node,
        String blockId
) throws IOException {

    if (!blockExists(node, blockId)) {
        return;
    }

    try (
            Socket socket = connect(node);
            DataInputStream input =
                    new DataInputStream(socket.getInputStream());
            DataOutputStream output =
                    new DataOutputStream(socket.getOutputStream())
    ) {

        output.writeUTF(StorageProtocol.DELETE);
        output.writeUTF(blockId);
        output.flush();

        checkResponse(input);
    }
}
}