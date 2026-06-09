const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const app = require('./app');
const { connect } = require('./db/mongo');

const PORT = Number(process.env.API_PORT || 4000);

async function start() {
  const uri = process.env.MONGODB_URI || null;
  if (uri) {
    try {
      await connect(uri);
      console.log('Connected to MongoDB');
    } catch (e) {
      console.error('Failed to connect to MongoDB, continuing without persistent DB');
    }
  }

  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

start();
