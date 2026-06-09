const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const base = 'http://localhost:4000';

const email = 'persist_test@example.com';
const password = 'PersistPass123!';

async function signupOrLogin() {
  try {
    const res = await fetch(`${base}/api/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Persist Tester' }),
    });
    const body = await res.json();
    if (res.status === 201 && body.accessToken) return body.accessToken;
    if (body && body.error && body.error.code === 'EMAIL_EXISTS') {
      // login
      const lr = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const lb = await lr.json();
      if (lr.ok && (lb.accessToken || lb.access_token || (lb.tokens && lb.tokens.access))) return lb.accessToken || lb.access_token || lb.tokens.access;
      throw new Error('Login failed: ' + JSON.stringify(lb));
    }
    throw new Error('Signup failed: ' + JSON.stringify(body));
  } catch (err) {
    console.error('Auth error', err);
    process.exit(1);
  }
}

async function createMeeting(access) {
  const meeting = { title: 'Persisted Meeting', duration: 45, scheduledAt: new Date(Date.now()+3600*1000).toISOString() };
  const res = await fetch(`${base}/api/meetings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` }, body: JSON.stringify(meeting) });
  const body = await res.json();
  if (res.status !== 201) {
    console.error('Create meeting failed', res.status, body);
    process.exit(1);
  }
  console.log('Created meeting', body);
  fs.writeFileSync('scripts/smoke_state.json', JSON.stringify({ email, password, meeting: body.data || body }, null, 2));
}

async function run() {
  const access = await signupOrLogin();
  console.log('Access token length', access.length);
  await createMeeting(access);
  console.log('Saved scripts/smoke_state.json');
}

run();
