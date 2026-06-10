const { io } = require('socket.io-client');

const fetch = globalThis.fetch || require('node-fetch');

const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
const socketBase = process.env.SOCKET_BASE_URL || 'http://localhost:4001';

function waitForEvent(socket, eventName, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    function handler(payload) {
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    }

    socket.on(eventName, handler);
  });
}

async function waitForParticipantCount(socket, expectedCount, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('participant:update', handler);
      reject(new Error(`Timed out waiting for participant count ${expectedCount}`));
    }, timeoutMs);

    function handler(payload) {
      const participants = payload?.participants || [];
      if (participants.length !== expectedCount) return;
      clearTimeout(timer);
      socket.off('participant:update', handler);
      resolve(payload);
    }

    socket.on('participant:update', handler);
  });
}

async function createUser(emailSuffix, name) {
  const email = `socket-${emailSuffix}-${Date.now()}@example.com`;
  const password = 'SocketPass123!';

  const response = await fetch(`${apiBase}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Signup failed for ${email}: ${JSON.stringify(body)}`);
  }

  return { email, password, accessToken: body.accessToken, user: body.user };
}

async function createMeeting(accessToken, title) {
  const response = await fetch(`${apiBase}/api/meetings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title, duration: 30, scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Meeting creation failed: ${JSON.stringify(body)}`);
  }

  return body;
}

function connectSocket(accessToken) {
  return io(socketBase, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token: accessToken },
  });
}

async function joinMeeting(socket, meetingId) {
  const joinedPromise = waitForEvent(socket, 'meeting:joined');
  socket.emit('meeting:join', { meetingId });
  const joined = await joinedPromise;
  if (joined.meetingId !== meetingId) {
    throw new Error(`Unexpected join payload: ${JSON.stringify(joined)}`);
  }
  return joined;
}

async function run() {
  const host = await createUser('host', 'Socket Host');
  const guest = await createUser('guest', 'Socket Guest');
  const meeting = await createMeeting(host.accessToken, 'Socket smoke meeting');

  const hostSocket = connectSocket(host.accessToken);
  const guestSocket = connectSocket(guest.accessToken);

  await Promise.all([
    new Promise((resolve, reject) => {
      hostSocket.once('connect', resolve);
      hostSocket.once('connect_error', reject);
      hostSocket.connect();
    }),
    new Promise((resolve, reject) => {
      guestSocket.once('connect', resolve);
      guestSocket.once('connect_error', reject);
      guestSocket.connect();
    }),
  ]);

  console.log('Sockets connected');

  const hostJoined = await joinMeeting(hostSocket, meeting.id);
  const guestJoined = await joinMeeting(guestSocket, meeting.id);

  if ((hostJoined.participants || []).length !== 1) {
    throw new Error(`Expected 1 participant after host join, got ${(hostJoined.participants || []).length}`);
  }

  if ((guestJoined.participants || []).length !== 2) {
    throw new Error(`Expected 2 participants after guest join, got ${(guestJoined.participants || []).length}`);
  }

  hostSocket.disconnect();
  const afterHostDisconnect = await waitForParticipantCount(guestSocket, 1);
  const participantsAfterDisconnect = afterHostDisconnect.participants || [];
  if (participantsAfterDisconnect.length !== 1) {
    throw new Error(`Expected 1 participant after host disconnect, got ${participantsAfterDisconnect.length}`);
  }

  const chatMessagePromise = waitForEvent(guestSocket, 'chat:new-message');
  const reconnectSocket = connectSocket(host.accessToken);
  await new Promise((resolve, reject) => {
    reconnectSocket.once('connect', resolve);
    reconnectSocket.once('connect_error', reject);
    reconnectSocket.connect();
  });
  const reconnectJoined = await joinMeeting(reconnectSocket, meeting.id);
  if ((reconnectJoined.participants || []).length !== 2) {
    throw new Error(`Expected 2 participants after reconnect join, got ${(reconnectJoined.participants || []).length}`);
  }
  reconnectSocket.emit('chat:message', { meetingId: meeting.id, text: 'hello from smoke test' });
  const chatMessage = await chatMessagePromise;
  if (!chatMessage.message || chatMessage.message.text !== 'hello from smoke test') {
    throw new Error(`Unexpected chat payload: ${JSON.stringify(chatMessage)}`);
  }

  reconnectSocket.disconnect();
  const afterReconnectDisconnect = await waitForParticipantCount(guestSocket, 1);
  const participantsAfterReconnectDisconnect = afterReconnectDisconnect.participants || [];
  if (participantsAfterReconnectDisconnect.length !== 1) {
    throw new Error(`Expected 1 participant after reconnect disconnect, got ${participantsAfterReconnectDisconnect.length}`);
  }

  guestSocket.disconnect();
  console.log('Socket presence smoke test passed');
}

run().catch((error) => {
  console.error('Socket presence smoke test failed');
  console.error(error);
  process.exitCode = 1;
});