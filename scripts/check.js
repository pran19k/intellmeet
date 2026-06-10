const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const syntaxFiles = [
  'apps/api/src/server.js',
  'apps/api/src/app.js',
  'apps/api/src/controllers/chatController.js',
  'apps/api/src/repositories/chatRepository.js',
  'apps/socket/src/server.js',
  'scripts/dev.js',
  'scripts/test_messages_api.js',
  'scripts/test_socket_integration.js',
  'scripts/smoke_socket_presence.js',
  'scripts/test_refresh.js',
  'scripts/smoke_test.js',
  'scripts/smoke_persist.js',
  'scripts/smoke_check_persist.js',
];

function runNodeCheck(file) {
  const absolutePath = path.join(rootDir, file);
  const result = spawnSync(process.execPath, ['--check', absolutePath], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Syntax check failed for ${file}`);
  }
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  if (result.status !== 0) {
    const rendered = [command].concat(args).join(' ');
    throw new Error(`Command failed: ${rendered}`);
  }
}

for (const file of syntaxFiles) {
  runNodeCheck(file);
}

runCommand(process.execPath, ['scripts/test_refresh.js']);
runCommand(process.execPath, ['scripts/smoke_test.js']);
runCommand(process.execPath, ['scripts/smoke_persist.js']);
runCommand(process.execPath, ['scripts/smoke_check_persist.js']);
runCommand(process.execPath, ['scripts/smoke_socket_presence.js']);
runCommand(process.execPath, ['scripts/test_messages_api.js']);
runCommand(process.execPath, ['scripts/test_socket_integration.js']);

console.log('Quality gate passed');
