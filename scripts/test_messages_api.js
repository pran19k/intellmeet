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

async function createUser(suffix, name) {
  const email = `msgtest-${suffix}-${Date.now()}@example.com`;
  const password = 'Password123!';
  const res = await fetch(`${apiBase}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error('signup failed ' + JSON.stringify(body));
  return { accessToken: body.accessToken, user: body.user };
}

async function createMeeting(token) {
  const res = await fetch(`${apiBase}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'Messages API Test', duration: 10, scheduledAt: new Date(Date.now() + 60000).toISOString() }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error('create meeting failed ' + JSON.stringify(body));
  return body;
}

function connectSocket(token) {
  return io(socketBase, { autoConnect: false, transports: ['websocket'], auth: { token } });
}

async function run() {
  const alice = await createUser('alice', 'Alice');
  const meeting = await createMeeting(alice.accessToken);

  const sock = connectSocket(alice.accessToken);
  await new Promise((res, rej) => { sock.once('connect', res); sock.once('connect_error', rej); sock.connect(); });

  const joined = await (async () => {
    const p = new Promise((res, rej) => { sock.once('meeting:joined', res); sock.once('meeting:error', rej); });
    sock.emit('meeting:join', { meetingId: meeting.id });
    return p;
  })();

  // send chat message
  const msgText = 'persistence test ' + Date.now();
  const chatPromise = waitForEvent(sock, 'chat:new-message');
  sock.emit('chat:message', { meetingId: meeting.id, text: msgText });
  const chatPayload = await chatPromise;
  if (!chatPayload || !chatPayload.message || chatPayload.message.text !== msgText) throw new Error('chat relay failed');

  // give time for persistence; try a few times because socket may initialize DB connection lazily
  let found = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
    // fetch messages via API
    const res = await fetch(`${apiBase}/api/meetings/${meeting.id}/messages`, {
      headers: { Authorization: `Bearer ${alice.accessToken}` },
    });
    const body = await res.json();
    if (!res.ok) continue;
    const items = body?.data?.items || [];
    found = items.find((m) => m.text === msgText);
    if (found) break;
  }

  if (!found) throw new Error('persisted message not found in API');

  console.log('Messages API persistence test passed');
  sock.disconnect();
}

run().catch((err) => { console.error(err); process.exitCode = 1; });
