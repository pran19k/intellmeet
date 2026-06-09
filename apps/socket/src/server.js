const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = Number(process.env.SOCKET_PORT || 4001);

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'socket' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
});

let io;
try {
  // Lazy require so the service can still run without socket.io installed
  // (useful during initial dev where dependencies might not be installed)
  // eslint-disable-next-line global-require
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: process.env.SOCKET_CORS_ORIGIN || '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    // join a meeting room
    socket.on('meeting:join', ({ meetingId, user } = {}) => {
      if (!meetingId) return socket.emit('error', { code: 'MISSING_MEETING_ID', message: 'meetingId required' });
      socket.join(meetingId);
      io.to(meetingId).emit('presence:update', { meetingId, user, action: 'join', socketId: socket.id });
    });

    // leave a meeting room
    socket.on('meeting:leave', ({ meetingId, user } = {}) => {
      if (!meetingId) return socket.emit('error', { code: 'MISSING_MEETING_ID', message: 'meetingId required' });
      socket.leave(meetingId);
      io.to(meetingId).emit('presence:update', { meetingId, user, action: 'leave', socketId: socket.id });
    });

    socket.on('disconnect', (reason) => {
      // Optionally handle disconnect cleanup if client sent last-known meetingId
      // For now, just log
      // eslint-disable-next-line no-console
      console.log(`socket disconnected ${socket.id} reason=${reason}`);
    });
  });
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('socket.io is not installed; socket endpoints disabled');
}

server.listen(PORT, () => {
  console.log(`Socket service listening on port ${PORT}`);
  if (io) console.log('Socket.io enabled');
});
