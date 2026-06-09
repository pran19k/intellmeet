const mongoose = require('mongoose');

async function connect(uri) {
  if (!uri) return null;
  try {
    await mongoose.connect(uri, { dbName: 'intellimeet' });
    return mongoose;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', err.message || err);
    throw err;
  }
}

module.exports = { connect, mongoose };
