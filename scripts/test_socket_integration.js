const { io } = require('socket.io-client');

const fetch = globalThis.fetch || require('node-fetch');

const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
const socketBase = process.env.SOCKET_BASE_URL || 'http://localhost:4001';

function waitForEvent(socket, eventName, timeoutMs = 5000) {
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

async function createUser(emailSuffix, name) {
  const email = `itest-${emailSuffix}-${Date.now()}@example.com`;
  const password = 'SocketPass123!';

  const response = await fetch(`${apiBase}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(`Signup failed: ${JSON.stringify(body)}`);
  return { email, password, accessToken: body.accessToken, user: body.user };
}

async function createMeeting(accessToken, title) {
  const response = await fetch(`${apiBase}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ title, duration: 15, scheduledAt: new Date(Date.now() + 60000).toISOString() }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Meeting creation failed: ${JSON.stringify(body)}`);
  return body;
}

function connectSocket(accessToken) {
  return io(socketBase, { autoConnect: false, transports: ['websocket'], auth: { token: accessToken } });
}

async function joinMeeting(socket, meetingId) {
  const joinedPromise = waitForEvent(socket, 'meeting:joined');
  socket.emit('meeting:join', { meetingId });
  const joined = await joinedPromise;
  if (joined.meetingId !== meetingId) throw new Error('Join response mismatch');
  return joined;
}

async function run() {
  const alice = await createUser('alice', 'Alice');
  const bob = await createUser('bob', 'Bob');
  const meeting = await createMeeting(alice.accessToken, 'Integration Test Meeting');

  const aSock = connectSocket(alice.accessToken);
  const bSock = connectSocket(bob.accessToken);

  await Promise.all([
    new Promise((res, rej) => { aSock.once('connect', res); aSock.once('connect_error', rej); aSock.connect(); }),
    new Promise((res, rej) => { bSock.once('connect', res); bSock.once('connect_error', rej); bSock.connect(); }),
  ]);

  // join
  const aJoined = await joinMeeting(aSock, meeting.id);
  if ((aJoined.participants || []).length !== 1) throw new Error('Alice should see 1 participant after join');

  const bJoined = await joinMeeting(bSock, meeting.id);
  if ((bJoined.participants || []).length !== 2) throw new Error('Bob should see 2 participants after join');

  // chat relay
  const chatPromise = waitForEvent(aSock, 'chat:new-message');
  bSock.emit('chat:message', { meetingId: meeting.id, text: 'hello alice' });
  const chat = await chatPromise;
  if (!chat.message || chat.message.text !== 'hello alice') throw new Error('Chat relay failed');

  // signaling relay (broadcast)
  const signalPromise = waitForEvent(bSock, 'signal');
  aSock.emit('signal', { meetingId: meeting.id, type: 'offer', data: { sdp: 'fake' } });
  const signal = await signalPromise;
  if (!signal || signal.type !== 'offer') throw new Error('Signal relay failed');

  // disconnect and cleanup
  aSock.disconnect();
  await waitForEvent(bSock, 'participant:update');

  bSock.disconnect();

  console.log('Socket integration test passed');
}

run().catch((err) => {
  console.error('Socket integration test failed');
  console.error(err);
  process.exitCode = 1;
});
