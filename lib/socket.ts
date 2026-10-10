import io, { Socket } from 'socket.io-client';

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://game-theory-gateway.onrender.com';

let socket: Socket | null = null;

export const initSocket = (token?: string): Socket => {
  const auth = token ? { token } : {};

  if (socket) {
    const currentToken = (socket.auth as { token?: string } | undefined)?.token;
    if (currentToken !== (token ?? undefined)) {
      socket.auth = auth;
      socket.disconnect().connect();
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    auth,
  });

  socket.on('connect', () => {
    console.log('✅ Connected to server');
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
};

export const getSocket = (): Socket => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
