const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const base = 'http://localhost:4000';

if (!fs.existsSync('scripts/smoke_state.json')) {
  console.error('Missing scripts/smoke_state.json — run smoke_persist.js first');
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync('scripts/smoke_state.json', 'utf8'));

async function login() {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: state.email, password: state.password }) });
  const body = await res.json();
  if (!res.ok) { console.error('Login failed', res.status, body); process.exit(1); }
  return body.accessToken || body.access_token || (body.tokens && body.tokens.access);
}

async function list(access) {
  const res = await fetch(`${base}/api/meetings`, { headers: { Authorization: `Bearer ${access}` } });
  const body = await res.json();
  console.log('List response', body);
}

async function run() {
  const access = await login();
  await list(access);
}

run();
