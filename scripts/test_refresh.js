const fetch = globalThis.fetch || require('node-fetch');

const base = 'http://localhost:4000';
const email = `refresh${Date.now()}@example.com`;
const password = 'RefreshPass123!';

async function run() {
  console.log('Signing up');
  let r = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name: 'Refresh Tester' }) });
  console.log('signup status', r.status);
  const s = await r.json(); console.log('signup body', s);
  let refresh = s.refreshToken || s.refresh_token || (s.tokens && s.tokens.refresh);
  if (!refresh) {
    console.log('Signup did not return refresh; attempting login');
    r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    console.log('login status', r.status);
    const l = await r.json(); console.log('login body', l);
    refresh = l.refreshToken || l.refresh_token || (l.tokens && l.tokens.refresh);
  }
  if (!refresh) { console.error('No refresh token available'); process.exit(1); }
  console.log('Refresh token length', refresh.length);

  // call refresh
  r = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) });
  console.log('refresh status', r.status);
  const body = await r.json(); console.log('refresh body', body);
}

run().catch(e=>{ console.error(e); process.exit(1); });
