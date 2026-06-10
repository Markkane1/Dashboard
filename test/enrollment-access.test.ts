const assert = require('node:assert/strict');
const { afterEach, describe, it } = require('node:test');

Object.assign(process.env, {
  AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret-value-with-32-characters',
  LOG_LEVEL: 'silent'
});

const { Enrollment, Course } = require('../src/server/models');
const { USER_ROLES } = require('../src/shared/permissions');
const { hasCourseAccess } = require('../src/server/services/enrollments');
const { checkCourseAccess } = require('../src/features/users/data/courseAccess');

const originalFindOne = Enrollment.findOne;

afterEach(() => {
  Enrollment.findOne = originalFindOne;
});

describe('course access authorization', () => {
  describe('checkCourseAccess helper (frontend)', () => {
    const adminUser = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@test.local',
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      createdAt: '2026-06-10T00:00:00Z'
    };

    const instructorUser = {
      id: 'instructor-1',
      name: 'Instructor',
      email: 'instructor@test.local',
      role: USER_ROLES.INSTRUCTOR,
      roles: [USER_ROLES.INSTRUCTOR],
      createdAt: '2026-06-10T00:00:00Z'
    };

    const studentUser = {
      id: 'student-1',
      name: 'Student',
      email: 'student@test.local',
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      enrolledCourses: ['course-1'],
      completedCourses: ['course-2'],
      createdAt: '2026-06-10T00:00:00Z'
    };

    const studentUserNoAccess = {
      id: 'student-2',
      name: 'Student 2',
      email: 'student2@test.local',
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      enrolledCourses: [],
      completedCourses: [],
      createdAt: '2026-06-10T00:00:00Z'
    };

    it('grants access to admin users', () => {
      assert.equal(checkCourseAccess(adminUser as any, 'course-1'), true);
      assert.equal(checkCourseAccess(adminUser as any, 'any-course'), true);
    });

    it('grants access to instructor users', () => {
      assert.equal(checkCourseAccess(instructorUser as any, 'course-1'), true);
      assert.equal(checkCourseAccess(instructorUser as any, 'any-course'), true);
    });

    it('grants access to student if actively enrolled', () => {
      assert.equal(checkCourseAccess(studentUser as any, 'course-1'), true);
    });

    it('grants access to student if completed', () => {
      assert.equal(checkCourseAccess(studentUser as any, 'course-2'), true);
    });

    it('denies access to student if neither enrolled nor completed', () => {
      assert.equal(checkCourseAccess(studentUserNoAccess as any, 'course-1'), false);
      assert.equal(checkCourseAccess(null, 'course-1'), false);
    });
  });

  describe('hasCourseAccess helper (backend)', () => {
    it('does not grant learner access from stale JWT enrollment claims', async () => {
      let databaseCheckedCount = 0;
      Enrollment.findOne = (query: unknown) => {
        databaseCheckedCount++;
        if (databaseCheckedCount === 1) {
          assert.deepEqual(query, { userId: 'user-1', courseId: 'course-1' });
        } else {
          assert.deepEqual(query, { userId: 'user-1', courseId: 'course-1', completed: true });
        }
        return Promise.resolve(null);
      };

      const hasAccess = await hasCourseAccess({
        id: 'user-1',
        email: 'learner@example.test',
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: [],
        enrolledCourses: ['course-1'],
        completedCourses: ['course-1']
      }, 'course-1');

      assert.equal(databaseCheckedCount, 2);
      assert.equal(hasAccess, false);
    });

    it('keeps privileged course access independent of enrollment records', async () => {
      let databaseChecked = false;
      Enrollment.findOne = () => {
        databaseChecked = true;
        return Promise.resolve(null);
      };

      const hasAccess = await hasCourseAccess({
        id: 'admin-1',
        email: 'admin@example.test',
        role: USER_ROLES.ADMIN,
        roles: [USER_ROLES.ADMIN],
        permissions: []
      }, 'course-1');

      assert.equal(databaseChecked, false);
      assert.equal(hasAccess, true);
    });

    it('grants learner access if they have completed the course even if not actively enrolled', async () => {
      let getEnrollmentCalled = false;
      let hasCompletedCourseCalled = false;

      const originalFindById = Course.findById;
      Course.findById = (id: any) => {
        assert.equal(String(id), 'course-1');
        return {
          select: (fields: string) => {
            assert.equal(fields, 'prerequisiteCourseIds publishStatus approvalStatus');
            return Promise.resolve({
              id: 'course-1',
              prerequisiteCourseIds: [],
              publishStatus: 'published',
              approvalStatus: 'approved'
            });
          }
        };
      };

      Enrollment.findOne = (query: any) => {
        if (query.completed === true) {
          hasCompletedCourseCalled = true;
          return Promise.resolve({ userId: 'user-1', courseId: 'course-1', completed: true });
        } else {
          getEnrollmentCalled = true;
          return Promise.resolve(null);
        }
      };

      try {
        const hasAccess = await hasCourseAccess({
          id: 'user-1',
          email: 'learner@example.test',
          role: USER_ROLES.STUDENT,
          roles: [USER_ROLES.STUDENT],
          permissions: [],
          enrolledCourses: [],
          completedCourses: ['course-1']
        }, 'course-1');

        assert.equal(getEnrollmentCalled, true);
        assert.equal(hasCompletedCourseCalled, true);
        assert.equal(hasAccess, true);
      } finally {
        Course.findById = originalFindById;
      }
    });
  });
});

export {};
