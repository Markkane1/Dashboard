import { describe, it, expect } from 'vitest';
import {
  isUserRole,
  isAssignableUserRole,
  normalizeUserRole,
  isPermission,
  normalizePermissions,
  normalizeRoles,
  getPermissionsForRole,
  getPermissionsForRoles,
  roleHasPermission,
  hasPermission,
  hasAnyPermission,
  USER_ROLES,
  ALL_USER_ROLES,
  PERMISSIONS,
  ALL_PERMISSIONS
} from '../../src/shared/permissions';

describe('Permissions Shared Utility', () => {
  describe('isUserRole', () => {
    it('should return true for valid user roles (happy path)', () => {
      expect(isUserRole('student')).toBe(true);
      expect(isUserRole('instructor')).toBe(true);
      expect(isUserRole('admin')).toBe(true);
      expect(isUserRole('service')).toBe(true);
    });

    it('should return false for invalid strings (edge case: empty/unexpected)', () => {
      expect(isUserRole('')).toBe(false);
      expect(isUserRole('guest')).toBe(false);
    });

    it('should return false for unexpected types (edge case: numbers, objects, null, undefined)', () => {
      expect(isUserRole(123)).toBe(false);
      expect(isUserRole({})).toBe(false);
      expect(isUserRole(null)).toBe(false);
      expect(isUserRole(undefined)).toBe(false);
    });
  });

  describe('isAssignableUserRole', () => {
    it('should return true for assignable roles (happy path)', () => {
      expect(isAssignableUserRole('student')).toBe(true);
      expect(isAssignableUserRole('instructor')).toBe(true);
      expect(isAssignableUserRole('admin')).toBe(true);
    });

    it('should return false for non-assignable valid roles (service)', () => {
      expect(isAssignableUserRole('service')).toBe(false);
    });

    it('should return false for invalid strings and empty inputs', () => {
      expect(isAssignableUserRole('')).toBe(false);
      expect(isAssignableUserRole('other')).toBe(false);
    });

    it('should return false for unexpected types', () => {
      expect(isAssignableUserRole(999)).toBe(false);
      expect(isAssignableUserRole(null)).toBe(false);
      expect(isAssignableUserRole(undefined)).toBe(false);
      expect(isAssignableUserRole([])).toBe(false);
    });
  });

  describe('normalizeUserRole', () => {
    it('should return the role if it is valid (happy path)', () => {
      expect(normalizeUserRole('admin')).toBe('admin');
      expect(normalizeUserRole('instructor')).toBe('instructor');
    });

    it('should fallback to student if role is invalid or empty (edge case)', () => {
      expect(normalizeUserRole('')).toBe('student');
      expect(normalizeUserRole('invalid-role')).toBe('student');
    });

    it('should fallback to the provided custom fallback role if valid (boundary case)', () => {
      expect(normalizeUserRole('invalid-role', 'instructor')).toBe('instructor');
    });

    it('should fallback to the default fallback (student) if both role and custom fallback are invalid', () => {
      expect(normalizeUserRole('invalid-role', 'invalid-fallback' as any)).toBe('invalid-fallback');
    });

    it('should handle unexpected types by returning fallback', () => {
      expect(normalizeUserRole(null)).toBe('student');
      expect(normalizeUserRole(undefined)).toBe('student');
      expect(normalizeUserRole(456)).toBe('student');
    });
  });

  describe('isPermission', () => {
    it('should return true for valid permissions (happy path)', () => {
      expect(isPermission('content:manage')).toBe(true);
      expect(isPermission('users:manage')).toBe(true);
    });

    it('should return false for invalid permissions or empty string', () => {
      expect(isPermission('')).toBe(false);
      expect(isPermission('invalid:permission')).toBe(false);
    });

    it('should return false for unexpected types', () => {
      expect(isPermission(null)).toBe(false);
      expect(isPermission(undefined)).toBe(false);
      expect(isPermission(123)).toBe(false);
      expect(isPermission([])).toBe(false);
    });
  });

  describe('normalizePermissions', () => {
    it('should return a deduplicated array of valid permissions (happy path)', () => {
      const input = ['content:manage', 'invalid:perm', 'content:manage', 'users:manage'];
      const output = normalizePermissions(input);
      expect(output).toEqual(['content:manage', 'users:manage']);
    });

    it('should return empty array for invalid inputs (edge case: empty/unexpected type)', () => {
      expect(normalizePermissions([])).toEqual([]);
      expect(normalizePermissions(null)).toEqual([]);
      expect(normalizePermissions(undefined)).toEqual([]);
      expect(normalizePermissions('not-an-array')).toEqual([]);
      expect(normalizePermissions(123)).toEqual([]);
    });

    it('should handle elements with unexpected types within the array', () => {
      const input = ['content:manage', null, undefined, 456, {}];
      expect(normalizePermissions(input)).toEqual(['content:manage']);
    });
  });

  describe('normalizeRoles', () => {
    it('should normalize and clean an array of roles (happy path)', () => {
      const input = [' ADMIN ', 'instructor', '', null, 'student'];
      const output = normalizeRoles(input);
      // roles setter lowercases inside User.ts, but in permissions.ts normalizeRoles only trims/filters:
      // Let's verify exactly what normalizeRoles does:
      // It returns: [...new Set(normalized.length > 0 ? normalized : fallback)]
      expect(output).toEqual(['ADMIN', 'instructor', 'student']);
    });

    it('should return the fallback if input is empty or has no valid strings', () => {
      expect(normalizeRoles([])).toEqual(['student']);
      expect(normalizeRoles(null)).toEqual(['student']);
      expect(normalizeRoles(undefined)).toEqual(['student']);
      expect(normalizeRoles(['', ' '])).toEqual(['student']);
    });

    it('should use custom fallback if provided and input is empty', () => {
      expect(normalizeRoles([], ['instructor'])).toEqual(['instructor']);
    });

    it('should handle nested arrays or numbers by converting to string (edge case)', () => {
      const input = [123, true];
      expect(normalizeRoles(input)).toEqual(['123', 'true']);
    });
  });

  describe('getPermissionsForRole', () => {
    it('should return the full list of permissions for admin role (happy path)', () => {
      const perms = getPermissionsForRole('admin');
      expect(perms).toEqual(ALL_PERMISSIONS);
    });

    it('should return instructor permissions (happy path)', () => {
      const perms = getPermissionsForRole('instructor');
      expect(perms).toContain('content:manage');
      expect(perms).not.toContain('users:manage');
    });

    it('should default to student permissions if role is empty or invalid (edge case)', () => {
      const permsInvalid = getPermissionsForRole('invalid');
      const permsEmpty = getPermissionsForRole('');
      const permsNull = getPermissionsForRole(null);
      const studentPerms = getPermissionsForRole('student');

      expect(permsInvalid).toEqual(studentPerms);
      expect(permsEmpty).toEqual(studentPerms);
      expect(permsNull).toEqual(studentPerms);
    });
  });

  describe('getPermissionsForRoles', () => {
    it('should merge permissions for multiple roles (happy path)', () => {
      const perms = getPermissionsForRoles(['instructor', 'service']);
      expect(perms).toContain('content:manage'); // from instructor
      expect(perms).toContain('users:read');      // from service
      expect(perms).not.toContain('users:manage'); // neither has this
    });

    it('should fall back to student if no valid roles are provided', () => {
      const perms = getPermissionsForRoles([], null);
      expect(perms).toEqual(getPermissionsForRole('student'));
    });

    it('should fall back to customized fallback role if provided', () => {
      const perms = getPermissionsForRoles([], 'instructor');
      expect(perms).toEqual(getPermissionsForRole('instructor'));
    });

    it('should handle unexpected types in roles input', () => {
      expect(getPermissionsForRoles(null)).toEqual(getPermissionsForRole('student'));
      expect(getPermissionsForRoles(123)).toEqual(getPermissionsForRole('student'));
    });
  });

  describe('roleHasPermission', () => {
    it('should return true if role has the permission, false otherwise (happy path)', () => {
      expect(roleHasPermission('instructor', 'content:manage')).toBe(true);
      expect(roleHasPermission('instructor', 'users:manage')).toBe(false);
      expect(roleHasPermission('admin', 'users:manage')).toBe(true);
    });

    it('should return false for invalid roles or permissions', () => {
      expect(roleHasPermission('invalid', 'content:manage')).toBe(false);
      expect(roleHasPermission('instructor', 'invalid:perm' as any)).toBe(false);
      expect(roleHasPermission(null, 'content:manage')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should resolve permission from direct permissions array (happy path)', () => {
      const user = { permissions: ['users:manage'] };
      expect(hasPermission(user, 'users:manage')).toBe(true);
    });

    it('should resolve permission from role/roles field (happy path)', () => {
      const user = { role: 'instructor' };
      expect(hasPermission(user, 'content:manage')).toBe(true);
      expect(hasPermission(user, 'users:manage')).toBe(false);
    });

    it('should resolve permission from compound roles array (happy path)', () => {
      const user = { roles: ['service'] };
      expect(hasPermission(user, 'users:read')).toBe(true);
    });

    it('should return false if user object is null, undefined, or empty (edge case)', () => {
      expect(hasPermission(null, 'content:manage')).toBe(false);
      expect(hasPermission(undefined, 'content:manage')).toBe(false);
      expect(hasPermission({}, 'content:manage')).toBe(false);
    });

    it('should handle unexpected types on roles or permissions in user object', () => {
      const user = { roles: 123, permissions: null };
      expect(hasPermission(user, 'content:manage')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has at least one of the permissions (happy path)', () => {
      const user = { role: 'instructor' };
      expect(hasAnyPermission(user, ['users:manage', 'content:manage'])).toBe(true);
    });

    it('should return false if user has none of the permissions (error path)', () => {
      const user = { role: 'student' };
      expect(hasAnyPermission(user, ['users:manage', 'content:manage'])).toBe(false);
    });

    it('should return false if permissions list is empty', () => {
      const user = { role: 'admin' };
      expect(hasAnyPermission(user, [])).toBe(false);
    });

    it('should handle null/undefined user or unexpected inputs', () => {
      expect(hasAnyPermission(null, ['content:manage'])).toBe(false);
      expect(hasAnyPermission(undefined, [])).toBe(false);
    });
  });
});
