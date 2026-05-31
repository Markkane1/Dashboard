const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Role = require('../models/Role');
const User = require('../models/User');
const { requirePermission } = require('../middleware/roles');
const { logger } = require('../logger');
const {
  ALL_PERMISSIONS,
  PERMISSION_CATALOG,
  PERMISSIONS,
  normalizePermissions,
} = require('../../shared/permissions');
import type { Request, Response } from 'express';

function slugifyRoleKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function serializeRole(role: any) {
  const plain = typeof role.toObject === 'function' ? role.toObject() : role;
  return {
    id: String(plain._id || plain.id),
    key: plain.key,
    name: plain.name,
    description: plain.description || '',
    permissions: normalizePermissions(plain.permissions),
    system: plain.system === true,
    active: plain.active !== false,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

router.get('/permissions', auth, requirePermission(PERMISSIONS.MANAGE_USERS), (_req: Request, res: Response) => {
  res.json(PERMISSION_CATALOG);
});

router.get('/', auth, requirePermission(PERMISSIONS.MANAGE_USERS), async (_req: Request, res: Response) => {
  try {
    await Role.ensureDefaultRoles();
    const roles = await Role.find({}).sort({ system: -1, name: 1 });
    res.json(roles.map(serializeRole));
  } catch (error) {
    logger.error({ err: error }, 'Error listing roles');
    res.status(500).json({ error: 'Failed to list roles' });
  }
});

router.post('/', auth, requirePermission(PERMISSIONS.MANAGE_USERS), async (req: Request, res: Response) => {
  try {
    const key = slugifyRoleKey(req.body.key || req.body.name);
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const permissions = normalizePermissions(req.body.permissions);

    if (!key || !name) {
      return res.status(400).json({ error: 'Role key and name are required.' });
    }

    const invalidPermissions = Array.isArray(req.body.permissions)
      ? req.body.permissions.filter((permission: unknown) => !ALL_PERMISSIONS.includes(permission))
      : [];
    if (invalidPermissions.length > 0) {
      return res.status(400).json({ error: 'One or more permissions are invalid.' });
    }

    const role = await Role.create({
      key,
      name,
      description,
      permissions,
      system: false,
      active: req.body.active !== false,
    });

    res.status(201).json(serializeRole(role));
  } catch (error) {
    logger.error({ err: error }, 'Error creating role');
    if ((error as { code?: number }).code === 11000) {
      return res.status(400).json({ error: 'Role key already exists.' });
    }
    res.status(500).json({ error: 'Failed to create role' });
  }
});

router.patch('/:id', auth, requirePermission(PERMISSIONS.MANAGE_USERS), async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      role.name = String(req.body.name || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      role.description = String(req.body.description || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'permissions')) {
      const invalidPermissions = Array.isArray(req.body.permissions)
        ? req.body.permissions.filter((permission: unknown) => !ALL_PERMISSIONS.includes(permission))
        : ['invalid'];
      if (invalidPermissions.length > 0) {
        return res.status(400).json({ error: 'One or more permissions are invalid.' });
      }
      role.permissions = normalizePermissions(req.body.permissions);
    }
    if (!role.system && Object.prototype.hasOwnProperty.call(req.body, 'key')) {
      const key = slugifyRoleKey(req.body.key);
      if (!key) {
        return res.status(400).json({ error: 'Role key is required.' });
      }
      role.key = key;
    }
    if (!role.system && Object.prototype.hasOwnProperty.call(req.body, 'active')) {
      role.active = req.body.active !== false;
    }

    await role.save();
    res.json(serializeRole(role));
  } catch (error) {
    logger.error({ err: error }, 'Error updating role');
    if ((error as { code?: number }).code === 11000) {
      return res.status(400).json({ error: 'Role key already exists.' });
    }
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.delete('/:id', auth, requirePermission(PERMISSIONS.MANAGE_USERS), async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    if (role.system) {
      return res.status(400).json({ error: 'System roles cannot be deleted.' });
    }

    await User.updateMany(
      { roles: role.key },
      { $pull: { roles: role.key } }
    );
    await role.deleteOne();
    res.status(204).end();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting role');
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

module.exports = router;

export {};
