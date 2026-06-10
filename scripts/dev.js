const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const services = [
  {
    name: 'api',
    script: path.join(rootDir, 'apps/api/src/server.js'),
  },
  {
    name: 'socket',
    script: path.join(rootDir, 'apps/socket/src/server.js'),
  },
];

const children = [];
let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 2000).unref();
}

function startService({ name, script }) {
  const child = spawn(process.execPath, [script], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'development',
    },
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const exitCode = typeof code === 'number' ? code : 1;
    console.error(`${name} service exited ${signal ? `with signal ${signal}` : `with code ${exitCode}`}`);
    stopAll(exitCode);
  });

  child.on('error', (err) => {
    if (shuttingDown) return;
    console.error(`${name} service failed to start:`, err.message || err);
    stopAll(1);
  });

  children.push(child);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

for (const service of services) {
  startService(service);
}

console.log('Dev services started: api, socket');
