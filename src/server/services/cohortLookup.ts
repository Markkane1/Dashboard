const Cohort = require('../models/Cohort');
const CohortMembership = require('../models/CohortMembership');

async function findCohortIdForUserCourse(userId: string, courseId: string): Promise<string | null> {
  try {
    const cohorts = await Cohort.find({ courseIds: courseId }).select('_id');
    if (cohorts.length === 0) return null;

    const cohortIds = cohorts.map((c: any) => c._id);
    const membership = await CohortMembership.findOne({
      userId,
      cohortId: { $in: cohortIds },
      status: 'active'
    }).select('cohortId');

    return membership ? membership.cohortId.toString() : null;
  } catch (error) {
    return null;
  }
}

module.exports = { findCohortIdForUserCourse };
