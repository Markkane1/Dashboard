import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

let mongoServer: MongoMemoryServer;

export async function connectDB() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  // Clean connection if existing
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  await mongoose.connect(uri);
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export function generateToken(
  user: { id?: string; _id?: any; email: string; role: string; roles?: string[]; permissions?: string[] },
  expiresIn = '1h'
) {
  const userId = user.id || user._id?.toString() || new mongoose.Types.ObjectId().toString();
  return jwt.sign(
    {
      id: userId,
      email: user.email,
      role: user.role,
      roles: user.roles || [user.role],
      permissions: user.permissions || [],
      tokenUse: 'api',
    },
    process.env.AUTH_SECRET || 'test_secret',
    {
      subject: userId,
      issuer: 'next-auth',
      audience: 'express-api',
      expiresIn,
    }
  );
}

// Global default mocks for third-party providers (to satisfy required module loads)
jest.mock('@/shared/email/getProvider', () => {
  return {
    getProvider: () => ({
      sendMail: jest.fn().mockResolvedValue(true),
      sendVerificationEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
    })
  };
});
