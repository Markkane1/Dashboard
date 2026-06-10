const mongoose = require('mongoose');
const { ALL_PERMISSIONS, USER_ROLES, ROLE_PERMISSIONS } = require('../../shared/permissions');

const roleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    permissions: {
      type: [String],
      enum: ALL_PERMISSIONS,
      default: []
    },
    system: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);

async function ensureDefaultRoles() {
  const defaults = [
    {
      key: USER_ROLES.STUDENT,
      name: 'Student',
      description: 'Learner access to courses and dashboard.',
      permissions: ROLE_PERMISSIONS[USER_ROLES.STUDENT],
      system: true,
      active: true
    },
    {
      key: USER_ROLES.INSTRUCTOR,
      name: 'Instructor',
      description: 'Instructor access to content and analytics tools.',
      permissions: ROLE_PERMISSIONS[USER_ROLES.INSTRUCTOR],
      system: true,
      active: true
    },
    {
      key: USER_ROLES.ADMIN,
      name: 'Admin',
      description: 'Full platform administration.',
      permissions: ROLE_PERMISSIONS[USER_ROLES.ADMIN],
      system: true,
      active: true
    },
    {
      key: USER_ROLES.SERVICE,
      name: 'Service',
      description: 'Internal service access for trusted server operations.',
      permissions: ROLE_PERMISSIONS[USER_ROLES.SERVICE],
      system: true,
      active: true
    }
  ];

  await Promise.all(defaults.map(async (role) => {
    const existingRole = await Role.findOne({ key: role.key });
    if (existingRole) {
      return;
    }

    try {
      await Role.create(role);
    } catch (error: any) {
      if (error?.code === 11000) {
        return;
      }
      throw error;
    }
  }));
}

module.exports = Role;
module.exports.ensureDefaultRoles = ensureDefaultRoles;

export {};
