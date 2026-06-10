import { io } from 'socket.io-client';

const SOCKET_BASE = import.meta.env.VITE_SOCKET_BASE || 'http://localhost:4001';

export function createMeetingSocket(token) {
  return io(SOCKET_BASE, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token },
  });
}