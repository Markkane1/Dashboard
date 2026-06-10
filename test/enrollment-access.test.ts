const assert = require('node:assert/strict');
const { afterEach, describe, it } = require('node:test');

const { Enrollment } = require('../src/server/models');
const { USER_ROLES } = require('../src/shared/permissions');
const { hasCourseAccess } = require('../src/server/services/enrollments');

const originalFindOne = Enrollment.findOne;

afterEach(() => {
  Enrollment.findOne = originalFindOne;
});

describe('course access authorization', () => {
  it('does not grant learner access from stale JWT enrollment claims', async () => {
    let databaseChecked = false;
    Enrollment.findOne = (query: unknown) => {
      databaseChecked = true;
      assert.deepEqual(query, { userId: 'user-1', courseId: 'course-1' });
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

    assert.equal(databaseChecked, true);
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
});

export {};
