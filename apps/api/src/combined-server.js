const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const app = require('./app');
const { connect } = require('./db/mongo');
const { attachSockets } = require('../../socket/src/server');

const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);

async function start() {
  const uri = process.env.MONGODB_URI || null;
  if (uri) {
    try {
      await connect(uri);
      console.log('Connected to MongoDB');
    } catch (_e) {
      console.error('Failed to connect to MongoDB, continuing without persistent DB', _e);
    }
  }

  const server = http.createServer(app);
  
  // Attach Socket.io to the same HTTP server
  attachSockets(server);

  server.listen(PORT, () => {
    console.log(`Combined API & Socket service listening on port ${PORT}`);
  });
}

start();
