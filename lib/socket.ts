import io, { Socket } from 'socket.io-client';

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://game-theory-gateway.onrender.com';

const DEVICE_ID_KEY = 'game_device_id';

let socket: Socket | null = null;

/**
 * Stable per-machine id used by the server session policy to decide whether
 * this computer may open more than one player link in a room.
 */
export const getDeviceId = (): string => {
  if (typeof window === 'undefined') return '';

  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const random =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    deviceId = `dev-${random}`;
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const initSocket = (token?: string): Socket => {
  const deviceId = getDeviceId();
  const auth: Record<string, string> = {};
  if (token) auth.token = token;
  if (deviceId) auth.device_id = deviceId;

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
