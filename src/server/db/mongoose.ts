const mongoose = require('mongoose');

let connectionPromise: Promise<typeof mongoose> | null = null;

function getMongoUri(): string {
  return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/elearning';
}

async function connectMongo(): Promise<typeof mongoose.connection> {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(getMongoUri());
  }

  await connectionPromise;
  return mongoose.connection;
}

module.exports = {
  connectMongo,
  getMongoUri
};

export { connectMongo, getMongoUri };
