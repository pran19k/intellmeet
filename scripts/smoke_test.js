const fetch = globalThis.fetch || require('node-fetch');

const base = 'http://localhost:4000';

async function run() {
  try {
    console.log('GET /health');
    let r = await fetch(`${base}/health`);
    console.log('status', r.status);
    console.log(await r.text());

    const email = `smoke${Date.now()}@example.com`;
    const signupBody = { email, password: 'Password123!', name: 'Smoke Tester' };
    console.log('\nPOST /api/auth/signup', signupBody);
    r = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signupBody) });
    console.log('status', r.status);
    const signup = await r.json();
    console.log('body', signup);

    let access = null;
    if (signup && signup.accessToken) access = signup.accessToken;
    if (!access) {
      console.log('Attempting login');
      const loginBody = { email, password: 'Password123!' };
      r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginBody) });
      console.log('login status', r.status);
      const login = await r.json();
      console.log('login body', login);
      access = login && (login.accessToken || login.access_token || (login.tokens && login.tokens.access));
    }

    if (!access) {
      console.error('No access token; aborting');
      return;
    }
    console.log('Access length', access.length);

    const meeting = { title: 'Smoke meeting', duration: 30, scheduledAt: new Date(Date.now()+3600*1000).toISOString() };
    console.log('\nPOST /api/meetings', meeting);
    r = await fetch(`${base}/api/meetings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` }, body: JSON.stringify(meeting) });
    console.log('create status', r.status);
    const createBody = await r.text();
    try { console.log('create body', JSON.parse(createBody)); } catch(e) { console.log('create raw', createBody); }

    console.log('\nGET /api/meetings');
    r = await fetch(`${base}/api/meetings`, { headers: { Authorization: `Bearer ${access}` } });
    console.log('list status', r.status);
    const listBody = await r.text();
    try { console.log('list body', JSON.parse(listBody)); } catch(e) { console.log('list raw', listBody); }

  } catch (err) {
    console.error('SMOKE ERROR', err);
  }
}

run();
