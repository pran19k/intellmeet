const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { verifyToken } = require('../../../apps/api/src/utils/jwt');
const { ACCESS_TOKEN_SECRET } = require('../../../apps/api/src/config/env');

const PORT = Number(process.env.SOCKET_PORT || 4001);
const API_BASE_URL = process.env.API_BASE_URL || process.env.API_URL || 'http://localhost:4000';
const REDIS_URL = process.env.REDIS_URL || '';

const meetingRooms = new Map();
const meetingMessages = new Map();
let redisAdapterEnabled = false;
let redisClient = null; // optional data client for room state & chat
let chatMessageModel = null;

// attempt to connect to API's MongoDB for optional chat persistence
if (process.env.MONGODB_URI) {
  try {
    // eslint-disable-next-line global-require
    const { connect } = require('../../../apps/api/src/db/mongo');
    connect(process.env.MONGODB_URI)
      .then((mongooseInstance) => {
        try {
          // eslint-disable-next-line global-require
          chatMessageModel = require('../../../apps/api/src/models/chatMessageModel')(mongooseInstance);
          // eslint-disable-next-line no-console
          console.log('Socket service: connected to MongoDB for chat persistence');
        } catch (e) {
          // eslint-disable-next-line no-console
          const _e = e;
          console.warn('Socket service: failed to initialize ChatMessage model', _e.message || _e);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('Socket service: MongoDB connection failed:', err.message || err);
      });
  } catch (_e) {
    // eslint-disable-next-line no-console
    console.warn('Socket service: mongo packages not available', _e.message || _e);
  }
}

async function getRoomParticipants(meetingId) {
  if (redisClient) {
    const key = `meeting:${meetingId}:participants`;
    const vals = await redisClient.hVals(key);
    return vals.map((v) => JSON.parse(v));
  }

  const room = meetingRooms.get(meetingId);
  return room ? Array.from(room.values()) : [];
}

async function getMeetingMessages(meetingId) {
  if (redisClient) {
    const key = `meeting:${meetingId}:messages`;
    const rows = await redisClient.lRange(key, 0, -1);
    return rows.map((r) => JSON.parse(r));
  }

  return meetingMessages.get(meetingId) || [];
}

async function _appendMeetingMessage(meetingId, message) {
  if (redisClient) {
    const key = `meeting:${meetingId}:messages`;
    // If we have a Mongo model, persist first so we can store the canonical persisted
    // message (with _id) into Redis and return the saved version.
    if (chatMessageModel) {
      try {
        const saved = await chatMessageModel.create({
          meetingId: message.meetingId,
          senderId: message.senderId,
          senderName: message.senderName,
          text: message.text,
          timestamp: message.timestamp,
        });
        const persisted = {
          ...message,
          id: saved._id ? String(saved._id) : undefined,
        };
        await redisClient.rPush(key, JSON.stringify(persisted));
        await redisClient.lTrim(key, -50, -1);
        return getMeetingMessages(meetingId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to persist chat message to MongoDB:', err.message || err);
        // fallback to pushing the non-persisted message
        await redisClient.rPush(key, JSON.stringify(message));
        await redisClient.lTrim(key, -50, -1);
        return getMeetingMessages(meetingId);
      }
    }

    await redisClient.rPush(key, JSON.stringify(message));
    // keep last 50 messages
    await redisClient.lTrim(key, -50, -1);
    return getMeetingMessages(meetingId);
  }

  const nextMessages = [...(await getMeetingMessages(meetingId)), message].slice(-50);
  meetingMessages.set(meetingId, nextMessages);
  // persist to MongoDB synchronously when available so callers can depend on durability
  if (chatMessageModel) {
    try {
      const saved = await chatMessageModel.create({
        meetingId: message.meetingId,
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.text,
        timestamp: message.timestamp,
      });
      const persisted = { ...message, id: saved._id ? String(saved._id) : undefined };
      const replaced = [...(await getMeetingMessages(meetingId)), persisted].slice(-50);
      meetingMessages.set(meetingId, replaced);
      return replaced;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to persist chat message to MongoDB:', err.message || err);
      return nextMessages;
    }
  }

  return nextMessages;
}

function isMeetingJoined(socket, meetingId) {
  return Boolean(socket.data.joinedMeetingIds && socket.data.joinedMeetingIds.has(meetingId));
}

function emitMeetingError(socket, code, message, meetingId) {
  socket.emit('meeting:error', { code, message, meetingId });
}

async function emitRoomState(io, meetingId) {
  const participants = await getRoomParticipants(meetingId);
  io.to(meetingId).emit('participant:update', {
    meetingId,
    participants,
  });
}

async function fetchMeeting(meetingId, token) {
  const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && payload.error ? payload.error : null;
    const message = error?.message || 'Unable to load meeting details.';
    const code = error?.code || 'MEETING_LOOKUP_FAILED';
    const status = response.status === 404 ? 404 : response.status === 401 ? 401 : 403;
    const failure = new Error(message);
    failure.code = code;
    failure.status = status;
    throw failure;
  }

  return payload;
}

function readAuthToken(socket) {
  const handshakeToken = socket.handshake.auth && socket.handshake.auth.token;
  if (handshakeToken) return handshakeToken;

  const header = socket.handshake.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' ? token : null;
}

function attachSockets(server) {
  let io;
try {
  // Lazy require so the service can still run without socket.io installed
  // (useful during initial dev where dependencies might not be installed)
  // eslint-disable-next-line global-require
  const { Server } = require('socket.io');
  const allowedOrigins = [
    'http://localhost:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  if (REDIS_URL) {
    try {
      // eslint-disable-next-line global-require
      const { createClient } = require('redis');
      // eslint-disable-next-line global-require
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = createClient({ url: REDIS_URL });
      const subClient = pubClient.duplicate();
      const dataClient = createClient({ url: REDIS_URL });

      Promise.all([pubClient.connect(), subClient.connect(), dataClient.connect()])
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          redisAdapterEnabled = true;
          redisClient = dataClient; // use separate client for data ops
          // eslint-disable-next-line no-console
          console.log('Socket.io Redis adapter enabled and data client connected');
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          const _error = error;
          console.warn('Redis adapter disabled:', _error.message);
        });
    } catch (error) {
      // eslint-disable-next-line no-console
      const _error = error;
      console.warn('Redis adapter packages are not installed; continuing without Redis scaling', _error && _error.message);
    }
  }

  io.use((socket, next) => {
    try {
      const token = readAuthToken(socket);
      if (!token) {
        const error = new Error('Access token is required.');
        error.data = { code: 'MISSING_ACCESS_TOKEN' };
        return next(error);
      }

      const payload = verifyToken(token, ACCESS_TOKEN_SECRET);
      if (payload.type !== 'access') {
        const error = new Error('Invalid access token.');
        error.data = { code: 'INVALID_ACCESS_TOKEN' };
        return next(error);
      }

      socket.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      socket.data.accessToken = token;
      socket.data.joinedMeetingIds = new Set();
      return next();
    } catch (error) {
      const authError = new Error(error.message || 'Invalid access token.');
      authError.data = { code: 'INVALID_ACCESS_TOKEN' };
      return next(authError);
    }
  });

  async function leaveMeeting(socket, meetingId) {
    if (!meetingId) return;

    if (redisClient) {
      const key = `meeting:${meetingId}:participants`;
      await redisClient.hDel(key, socket.id);
      socket.data.joinedMeetingIds && socket.data.joinedMeetingIds.delete(meetingId);
      socket.leave(meetingId);

      const remaining = await redisClient.hLen(key);
      if (remaining === 0) {
        await redisClient.del(key);
        return;
      }

      await emitRoomState(io, meetingId);
      return;
    }

    const room = meetingRooms.get(meetingId);
    if (!room) return;

    room.delete(socket.id);
    socket.data.joinedMeetingIds && socket.data.joinedMeetingIds.delete(meetingId);
    socket.leave(meetingId);

    if (room.size === 0) {
      meetingRooms.delete(meetingId);
      return;
    }

    await emitRoomState(io, meetingId);
  }

  io.on('connection', (socket) => {
    socket.emit('socket:ready', { user: socket.data.user });

    // join a meeting room
    socket.on('meeting:join', async ({ meetingId } = {}) => {
      if (!meetingId) {
        socket.emit('meeting:error', { code: 'MISSING_MEETING_ID', message: 'meetingId required' });
        return;
      }

      try {
        const meeting = await fetchMeeting(meetingId, socket.data.accessToken);
        const participant = {
          id: socket.data.user.id,
          name: socket.data.user.email,
          email: socket.data.user.email,
          role: socket.data.user.role,
          socketId: socket.id,
        };

        // store participant in Redis or in-memory
        if (redisClient) {
          const key = `meeting:${meetingId}:participants`;
          await redisClient.hSet(key, socket.id, JSON.stringify(participant));
          socket.data.joinedMeetingIds.add(meetingId);
          socket.join(meetingId);

          const participants = await getRoomParticipants(meetingId);
          const messages = await getMeetingMessages(meetingId);

          socket.emit('meeting:joined', {
            meetingId,
            meeting: {
              id: meeting.id,
              title: meeting.title,
              description: meeting.description,
              status: meeting.status,
            },
            participant,
            participants,
            messages,
          });

          await emitRoomState(io, meetingId);
        } else {
          let room = meetingRooms.get(meetingId);
          if (!room) {
            room = new Map();
            meetingRooms.set(meetingId, room);
          }

          room.set(socket.id, participant);
          socket.data.joinedMeetingIds.add(meetingId);
          socket.join(meetingId);

          socket.emit('meeting:joined', {
            meetingId,
            meeting: {
              id: meeting.id,
              title: meeting.title,
              description: meeting.description,
              status: meeting.status,
            },
            participant,
            participants: await getRoomParticipants(meetingId),
            messages: await getMeetingMessages(meetingId),
          });

          await emitRoomState(io, meetingId);
        }
      } catch (error) {
        emitMeetingError(socket, error.code || 'MEETING_JOIN_FAILED', error.message || 'Unable to join meeting.', meetingId);
      }
    });

    socket.on('chat:message', async ({ meetingId, text } = {}) => {
      if (!meetingId) {
        emitMeetingError(socket, 'MISSING_MEETING_ID', 'meetingId required', meetingId);
        return;
      }

      if (!isMeetingJoined(socket, meetingId)) {
        emitMeetingError(socket, 'NOT_IN_MEETING', 'Join the meeting before sending messages.', meetingId);
        return;
      }

      const messageText = String(text || '').trim();
      if (!messageText) {
        emitMeetingError(socket, 'EMPTY_MESSAGE', 'Message text is required.', meetingId);
        return;
      }

      const message = {
        id: `${Date.now()}-${socket.id}`,
        meetingId,
        senderId: socket.data.user.id,
        senderName: socket.data.user.email,
        text: messageText,
        timestamp: new Date().toISOString(),
      };

      // ensure durability: persist to Mongo if available, otherwise store in Redis/in-memory
      // and fall back to the API with retries. Broadcast only after persistence is confirmed
      // where possible so tests and clients can rely on durability.
      let persistedMessage = message;

      const doFallbackPersist = async () => {
        const maxAttempts = 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const resp = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${socket.data.accessToken}`,
              },
              body: JSON.stringify({ text: message.text, timestamp: message.timestamp }),
            });
            const body = await resp.json().catch(() => null);
            if (resp.ok && body && body.data) {
              const saved = body.data;
              return {
                ...message,
                id: saved.id || (saved._id ? String(saved._id) : undefined),
                timestamp: saved.timestamp || message.timestamp,
                senderId: saved.senderId || message.senderId,
                senderName: saved.senderName || message.senderName,
              };
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('Fallback persist attempt failed:', err.message || err);
          }
          // small backoff
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        }
        return null;
      };

      if (redisClient) {
        const key = `meeting:${meetingId}:messages`;
        if (chatMessageModel) {
          try {
            const saved = await chatMessageModel.create({
              meetingId: message.meetingId,
              senderId: message.senderId,
              senderName: message.senderName,
              text: message.text,
              timestamp: message.timestamp,
            });
            persistedMessage = { ...message, id: saved._id ? String(saved._id) : undefined };
            await redisClient.rPush(key, JSON.stringify(persistedMessage));
            await redisClient.lTrim(key, -50, -1);
          } catch (err) {
            // failed to persist locally; push to redis and try API fallback
            // eslint-disable-next-line no-console
            console.warn('Local Mongo persist failed, pushing to Redis and falling back to API:', err.message || err);
            await redisClient.rPush(key, JSON.stringify(message));
            await redisClient.lTrim(key, -50, -1);
            const fb = await doFallbackPersist();
            if (fb) persistedMessage = fb;
          }
        } else {
          await redisClient.rPush(key, JSON.stringify(message));
          await redisClient.lTrim(key, -50, -1);
          const fb = await doFallbackPersist();
          if (fb) persistedMessage = fb;
        }
      } else {
        // in-memory
        const cur = meetingMessages.get(meetingId) || [];
        if (chatMessageModel) {
          try {
            const saved = await chatMessageModel.create({
              meetingId: message.meetingId,
              senderId: message.senderId,
              senderName: message.senderName,
              text: message.text,
              timestamp: message.timestamp,
            });
            persistedMessage = { ...message, id: saved._id ? String(saved._id) : undefined };
            const next = [...cur, persistedMessage].slice(-50);
            meetingMessages.set(meetingId, next);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('Local Mongo persist failed, storing in-memory and falling back to API:', err.message || err);
            const next = [...cur, message].slice(-50);
            meetingMessages.set(meetingId, next);
            const fb = await doFallbackPersist();
            if (fb) persistedMessage = fb;
          }
        } else {
          const next = [...cur, message].slice(-50);
          meetingMessages.set(meetingId, next);
          const fb = await doFallbackPersist();
          if (fb) persistedMessage = fb;
        }
      }

      io.to(meetingId).emit('chat:new-message', { meetingId, message: persistedMessage });
    });

    socket.on('chat:typing', ({ meetingId, isTyping } = {}) => {
      if (!meetingId || !isMeetingJoined(socket, meetingId)) return;

      socket.to(meetingId).emit('chat:typing', {
        meetingId,
        senderId: socket.data.user.id,
        senderName: socket.data.user.email,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on('signal', ({ meetingId, targetPeerId, type, data } = {}) => {
      if (!meetingId) {
        emitMeetingError(socket, 'MISSING_MEETING_ID', 'meetingId required', meetingId);
        return;
      }

      if (!isMeetingJoined(socket, meetingId)) {
        emitMeetingError(socket, 'NOT_IN_MEETING', 'Join the meeting before sending signaling data.', meetingId);
        return;
      }

      const signal = {
        meetingId,
        senderPeerId: socket.id,
        senderId: socket.data.user.id,
        senderName: socket.data.user.email,
        targetPeerId: targetPeerId || null,
        type,
        data,
      };

      if (targetPeerId) {
        io.to(targetPeerId).emit('signal', signal);
        return;
      }

      socket.to(meetingId).emit('signal', signal);
    });

    // leave a meeting room
    socket.on('meeting:leave', async ({ meetingId } = {}) => {
      if (!meetingId) return emitMeetingError(socket, 'MISSING_MEETING_ID', 'meetingId required', meetingId);
      await leaveMeeting(socket, meetingId);
      socket.emit('meeting:left', { meetingId });
    });

    socket.on('disconnect', async (reason) => {
      const joinedMeetingIds = socket.data.joinedMeetingIds || new Set();
      for (const meetingId of joinedMeetingIds) {
        // ensure cleanup persisted
        // eslint-disable-next-line no-await-in-loop
        await leaveMeeting(socket, meetingId);
      }

      // eslint-disable-next-line no-console
      console.log(`socket disconnected ${socket.id} reason=${reason}`);
    });
  });
  } catch (_e) {
    // eslint-disable-next-line no-console
    console.warn('socket.io is not installed; socket endpoints disabled', _e && _e.message);
  }
  return io;
}

module.exports = { attachSockets };
