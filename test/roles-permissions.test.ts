const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

Object.assign(process.env, {
  NODE_ENV: 'test',
  AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret-value-with-32-characters',
  MONGOMS_DOWNLOAD_DIR: path.join(__dirname, '.mongodb-binaries'),
  LOG_LEVEL: 'silent'
});

const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/server/server');
const User = require('../src/server/models/User');
const Role = require('../src/server/models/Role');
const { PERMISSIONS, USER_ROLES } = require('../src/shared/permissions');

let mongoServer: typeof MongoMemoryServer.prototype;
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      systemBinary: getSystemMongoBinary()
    }
  });
  await mongoose.connect(mongoServer.getUri());
  await Role.ensureDefaultRoles();

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve());
  });
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('role and permission administration', () => {
  it('creates dynamic roles and assigns multiple roles plus direct permissions to a user', async () => {
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: []
    });
    const learner = await User.create({
      name: 'Learner User',
      email: 'learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const authHeader = { Authorization: `Bearer ${signApiToken(admin)}` };

    const catalogResponse = await fetch(`${baseUrl}/api/roles/permissions`, { headers: authHeader });
    assert.equal(catalogResponse.status, 200);
    const catalog = await catalogResponse.json();
    assert.ok(catalog.some((item: { id: string }) => item.id === PERMISSIONS.MANAGE_CONTENT));

    const createRoleResponse = await fetch(`${baseUrl}/api/roles`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'content-reviewer',
        name: 'Content Reviewer',
        description: 'Reviews course content.',
        permissions: [PERMISSIONS.ACCESS_INSTRUCTOR, PERMISSIONS.MANAGE_CONTENT],
        active: true
      })
    });
    assert.equal(createRoleResponse.status, 201);
    const createdRole = await createRoleResponse.json();
    assert.equal(createdRole.key, 'content-reviewer');

    const updateRoleResponse = await fetch(`${baseUrl}/api/roles/${createdRole.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions: [
          PERMISSIONS.ACCESS_INSTRUCTOR,
          PERMISSIONS.MANAGE_CONTENT,
          PERMISSIONS.VIEW_ANALYTICS
        ]
      })
    });
    assert.equal(updateRoleResponse.status, 200);

    const assignResponse = await fetch(`${baseUrl}/api/users/${learner._id.toString()}/role`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roles: [USER_ROLES.STUDENT, 'content-reviewer'],
        permissions: [PERMISSIONS.ANNOUNCE_NOTIFICATIONS]
      })
    });
    assert.equal(assignResponse.status, 200);
    const assignedUser = await assignResponse.json();

    assert.deepEqual(assignedUser.roles.sort(), [USER_ROLES.STUDENT, 'content-reviewer'].sort());
    assert.equal(assignedUser.role, USER_ROLES.STUDENT);
    assert.ok(assignedUser.permissions.includes(PERMISSIONS.ENROLL_COURSE));
    assert.ok(assignedUser.permissions.includes(PERMISSIONS.MANAGE_CONTENT));
    assert.ok(assignedUser.permissions.includes(PERMISSIONS.VIEW_ANALYTICS));
    assert.ok(assignedUser.permissions.includes(PERMISSIONS.ANNOUNCE_NOTIFICATIONS));
    assert.deepEqual(assignedUser.directPermissions, [PERMISSIONS.ANNOUNCE_NOTIFICATIONS]);
  });
});

function signApiToken(user: { _id: { toString(): string }; email: string; role: string; roles: string[] }) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      roles: user.roles,
      permissions: [PERMISSIONS.MANAGE_USERS],
      tokenUse: 'api'
    },
    process.env.AUTH_SECRET,
    {
      subject: user._id.toString(),
      issuer: 'next-auth',
      audience: 'express-api',
      expiresIn: '5m'
    }
  );
}

function getSystemMongoBinary() {
  const candidates = [
    process.env.MONGOMS_SYSTEM_BINARY,
    'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe'
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

export {};
