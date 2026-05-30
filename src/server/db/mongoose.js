const mongoose = require('mongoose');

let connectionPromise = null;

function getMongoUri() {
  return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/elearning';
}

async function connectMongo() {
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
