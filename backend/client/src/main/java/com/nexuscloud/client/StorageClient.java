package com.nexuscloud.client;

import com.nexuscloud.common.protocol.StorageProtocol;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;

public class StorageClient {

    private final String host;
    private final int port;

    public StorageClient(String host, int port) {
        this.host = host;
        this.port = port;
    }

    private Socket connect() throws IOException {

        Socket socket = new Socket();

        try {
            socket.connect(
                    new InetSocketAddress(host, port),
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

    public boolean ping() throws IOException {

        try (
                Socket socket = connect();
                DataInputStream input =
                        new DataInputStream(socket.getInputStream());
                DataOutputStream output =
                        new DataOutputStream(socket.getOutputStream())
        ) {

            output.writeUTF(StorageProtocol.PING);
            output.flush();

            checkResponse(input);

            return true;
        }
    }

    public void putBlock(String blockId, byte[] data)
            throws IOException {

        if (data == null
                || data.length > StorageProtocol.DEFAULT_BLOCK_SIZE) {
            throw new IllegalArgumentException("Invalid block size");
        }

        try (
                Socket socket = connect();
                DataInputStream input =
                        new DataInputStream(socket.getInputStream());
                DataOutputStream output =
                        new DataOutputStream(socket.getOutputStream())
        ) {

            output.writeUTF(StorageProtocol.PUT);
            output.writeUTF(blockId);
            output.writeInt(data.length);
            output.write(data);
            output.flush();

            checkResponse(input);
        }
    }

    public byte[] getBlock(String blockId)
            throws IOException {

        try (
                Socket socket = connect();
                DataInputStream input =
                        new DataInputStream(socket.getInputStream());
                DataOutputStream output =
                        new DataOutputStream(socket.getOutputStream())
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

    public boolean blockExists(String blockId)
            throws IOException {

        try (
                Socket socket = connect();
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

    public void deleteBlock(String blockId)
            throws IOException {

        try (
                Socket socket = connect();
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