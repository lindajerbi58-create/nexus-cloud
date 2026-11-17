package com.nexuscloud.storage;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public class StorageServer implements AutoCloseable {

    private final ServerSocket serverSocket;
    private final BlockStorage storage;

    private final ThreadPoolExecutor threadPool =
            new ThreadPoolExecutor(
                    10,
                    10,
                    0L,
                    TimeUnit.MILLISECONDS,
                    new ArrayBlockingQueue<>(100)
            );

    public StorageServer(
            int port,
            BlockStorage storage
    ) throws IOException {

        this.storage = storage;
        this.serverSocket = new ServerSocket(port);
    }

    public void start() throws IOException {

        System.out.println(
                "[TCP] Listening on port "
                + serverSocket.getLocalPort()
        );

        while (!serverSocket.isClosed()) {

            Socket clientSocket;

            try {

                clientSocket = serverSocket.accept();

            } catch (IOException e) {

                if (serverSocket.isClosed()) {
                    break;
                }

                throw e;
            }

            try {

                threadPool.execute(
                        new ClientHandler(
                                clientSocket,
                                storage
                        )
                );

            } catch (RejectedExecutionException e) {

                clientSocket.close();

                System.err.println(
                        "[TCP] Server busy"
                );
            }
        }
    }

    @Override
    public void close() throws IOException {

        try {

            serverSocket.close();

        } finally {

            threadPool.shutdown();
        }
    }
}