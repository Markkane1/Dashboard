import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

// Define mock model objects inside a hoisted block to prevent initialization errors
const { mockCourseModel, mockEnrollmentModel } = vi.hoisted(() => {
  return {
    mockCourseModel: {
      findOne: vi.fn()
    },
    mockEnrollmentModel: {
      find: vi.fn()
    }
  };
});

// Mock the models import in the service file
vi.mock('../../src/server/models', () => {
  return {
    Course: mockCourseModel,
    Enrollment: mockEnrollmentModel
  };
});

// Import the service under test
import {
  getMissingPrerequisiteIds,
  getPublishedCourseById,
  isCoursePublishable
} from '../../src/server/services/courseAccessRules';

describe('Course Access Rules Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isCoursePublishable', () => {
    it('should return true if status is published (happy path)', () => {
      expect(isCoursePublishable({ status: 'published' })).toBe(true);
    });

    it('should return false if status is draft or other value (sad path)', () => {
      expect(isCoursePublishable({ status: 'draft' })).toBe(false);
      expect(isCoursePublishable({ status: 'pending' })).toBe(false);
    });

    it('should support legacy schema fallback with approvalStatus and publishStatus (happy path)', () => {
      expect(isCoursePublishable({
        approvalStatus: 'approved',
        publishStatus: 'published'
      })).toBe(true);
    });

    it('should return false for legacy schema fallback if not approved or not published', () => {
      expect(isCoursePublishable({
        approvalStatus: 'approved',
        publishStatus: 'draft'
      })).toBe(false);
      expect(isCoursePublishable({
        approvalStatus: 'pending',
        publishStatus: 'published'
      })).toBe(false);
    });

    it('should return false for empty/null/undefined course payloads (edge cases)', () => {
      expect(isCoursePublishable(null)).toBe(false);
      expect(isCoursePublishable(undefined)).toBe(false);
      expect(isCoursePublishable({})).toBe(false);
    });

    it('should handle unexpected types (edge case: string, number)', () => {
      expect(isCoursePublishable('published')).toBe(false);
      expect(isCoursePublishable(123)).toBe(false);
    });
  });

  describe('getPublishedCourseById', () => {
    it('should return null for invalid ObjectIds (edge case)', async () => {
      const result = await getPublishedCourseById('invalid-id');
      expect(result).toBeNull();
      expect(mockCourseModel.findOne).not.toHaveBeenCalled();
    });

    it('should fetch published course when valid ObjectId is provided (happy path)', async () => {
      const mockCourse = { _id: '507f1f77bcf86cd799439011', title: 'Test Course', status: 'published' };
      mockCourseModel.findOne.mockResolvedValue(mockCourse);

      const validId = '507f1f77bcf86cd799439011';
      const result = await getPublishedCourseById(validId);

      expect(mockCourseModel.findOne).toHaveBeenCalledWith({
        _id: validId,
        $or: [
          { status: 'published' },
          { status: { $exists: false }, publishStatus: 'published', approvalStatus: 'approved' }
        ]
      });
      expect(result).toEqual(mockCourse);
    });

    it('should handle null/undefined inputs', async () => {
      expect(await getPublishedCourseById(null)).toBeNull();
      expect(await getPublishedCourseById(undefined)).toBeNull();
    });

    it('should propagate query errors (error path)', async () => {
      mockCourseModel.findOne.mockRejectedValue(new Error('DB Query Failed'));
      await expect(getPublishedCourseById('507f1f77bcf86cd799439011')).rejects.toThrow('DB Query Failed');
    });
  });

  describe('getMissingPrerequisiteIds', () => {
    const userId = 'user123';

    it('should return empty list if course has no prerequisites (happy path)', async () => {
      const course = { prerequisiteCourseIds: [] };
      const missing = await getMissingPrerequisiteIds(userId, course);
      expect(missing).toEqual([]);
      expect(mockEnrollmentModel.find).not.toHaveBeenCalled();
    });

    it('should return empty list if all prerequisites are completed (happy path)', async () => {
      const course = {
        prerequisiteCourseIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
      };
      
      // Mock find to return both prerequisites completed
      mockEnrollmentModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue([
          { courseId: '507f1f77bcf86cd799439011' },
          { courseId: '507f1f77bcf86cd799439012' }
        ])
      });

      const missing = await getMissingPrerequisiteIds(userId, course);
      expect(missing).toEqual([]);
      expect(mockEnrollmentModel.find).toHaveBeenCalledWith({
        userId,
        courseId: { $in: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'] },
        completed: true
      });
    });

    it('should return missing prerequisites if some are incomplete (happy path)', async () => {
      const course = {
        prerequisiteCourseIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
      };
      
      // Mock find to return only one completed
      mockEnrollmentModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue([
          { courseId: '507f1f77bcf86cd799439011' }
        ])
      });

      const missing = await getMissingPrerequisiteIds(userId, course);
      expect(missing).toEqual(['507f1f77bcf86cd799439012']);
    });

    it('should handle non-array prerequisiteCourseIds field gracefully (edge case)', async () => {
      const missingNull = await getMissingPrerequisiteIds(userId, { prerequisiteCourseIds: null });
      const missingStr = await getMissingPrerequisiteIds(userId, { prerequisiteCourseIds: 'not-an-array' as any });
      
      expect(missingNull).toEqual([]);
      expect(missingStr).toEqual([]);
    });

    it('should handle null/undefined course or user inputs', async () => {
      expect(await getMissingPrerequisiteIds(null, null)).toEqual([]);
      expect(await getMissingPrerequisiteIds(undefined, undefined)).toEqual([]);
    });

    it('should propagate query errors (error path)', async () => {
      const course = { prerequisiteCourseIds: ['507f1f77bcf86cd799439011'] };
      mockEnrollmentModel.find.mockReturnValue({
        select: vi.fn().mockRejectedValue(new Error('Enrollment lookup failed'))
      });

      await expect(getMissingPrerequisiteIds(userId, course)).rejects.toThrow('Enrollment lookup failed');
    });
  });
});
