import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import User from '../../src/server/models/User';
import Progress from '../../src/server/models/Progress';

describe('Custom Mongoose Validators & Hooks', () => {
  describe('User Roles Setter', () => {
    it('should set roles array with trimmed lowercase values and filter empty values (happy path)', () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        roles: [' ADMIN ', 'instructor', '  ', '', 'Student']
      });

      expect(user.roles).toEqual(['admin', 'instructor', 'student']);
    });

    it('should fallback to student role if roles array is empty or invalid (edge case)', () => {
      const userEmpty = new User({ roles: [] });
      const userNull = new User({ roles: null });
      const userNotArray = new User({ roles: 'not-an-array' as any });

      expect(userEmpty.roles).toEqual(['student']);
      expect(userNull.roles).toEqual(['student']);
      expect(userNotArray.roles).toEqual(['student']);
    });

    it('should remove duplicates and trim correctly (edge case deduplication)', () => {
      const user = new User({
        roles: ['instructor', ' INSTRUCTOR ', 'instructor']
      });

      expect(user.roles).toEqual(['instructor']);
    });

    it('should handle unexpected elements inside the array (edge case unexpected types)', () => {
      const user = new User({
        roles: [123, null, undefined, 'admin']
      });

      expect(user.roles).toEqual(['123', 'admin']);
    });
  });

  describe('Progress Pre-Save Hook', () => {
    // Locate the pre-save hook function from the Mongoose schema middleware stack
    const getPreSaveHook = () => {
      const hooks = Progress.schema.s.hooks;
      const savePres = hooks._pres.get('save') || [];
      const customHook = savePres.find((pre: any) => 
        pre.fn.toString().includes('watchedSeconds')
      );
      if (!customHook) {
        throw new Error('Pre-save hook on Progress model not found');
      }
      return customHook.fn;
    };

    it('should set completed to true if watchedSeconds is >= 90% of duration (happy path)', () => {
      const hookFn = getPreSaveHook();
      
      const context = {
        duration: 100,
        watchedSeconds: 90,
        completed: false
      };

      let nextCalled = false;
      hookFn.call(context, (err?: any) => {
        expect(err).toBeUndefined();
        nextCalled = true;
      });

      expect(context.completed).toBe(true);
      expect(nextCalled).toBe(true);
    });

    it('should set completed to false if watchedSeconds is < 90% of duration (happy path below threshold)', () => {
      const hookFn = getPreSaveHook();
      
      const context = {
        duration: 100,
        watchedSeconds: 89.9,
        completed: false
      };

      hookFn.call(context, () => {});

      expect(context.completed).toBe(false);
    });

    it('should handle zero duration and set completed to false (edge case)', () => {
      const hookFn = getPreSaveHook();
      
      const context = {
        duration: 0,
        watchedSeconds: 10,
        completed: false
      };

      hookFn.call(context, () => {});

      expect(context.completed).toBe(false);
    });

    it('should handle missing, null, or undefined duration and watchedSeconds (edge cases)', () => {
      const hookFn = getPreSaveHook();
      
      const contextNull = {
        duration: undefined,
        watchedSeconds: 10,
        completed: false
      };

      hookFn.call(contextNull, () => {});
      expect(contextNull.completed).toBe(false);
    });

    it('should set completed to true for boundary case (exact min/max boundary values)', () => {
      const hookFn = getPreSaveHook();
      
      // watchedSeconds matches duration * 0.9 exactly
      const context1 = { duration: 10, watchedSeconds: 9, completed: false };
      hookFn.call(context1, () => {});
      expect(context1.completed).toBe(true);

      // watchedSeconds exceeds duration
      const context2 = { duration: 10, watchedSeconds: 15, completed: false };
      hookFn.call(context2, () => {});
      expect(context2.completed).toBe(true);
    });
  });
});
