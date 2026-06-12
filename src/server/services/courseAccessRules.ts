import mongoose from 'mongoose';
import { Course, Enrollment } from '../models';

async function getMissingPrerequisiteIds(userId: unknown, course: any): Promise<string[]> {
  const prerequisiteIds = Array.isArray(course?.prerequisiteCourseIds)
    ? course.prerequisiteCourseIds.map((id: unknown) => String(id))
    : [];
  if (prerequisiteIds.length === 0) {
    return [];
  }

  const completed = await Enrollment.find({
    userId,
    courseId: { $in: prerequisiteIds },
    completed: true
  }).select('courseId');
  const completedIds = new Set(completed.map((item: any) => String(item.courseId)));

  return prerequisiteIds.filter((id: string) => !completedIds.has(id));
}

async function getPublishedCourseById(courseId: unknown) {
  if (!mongoose.Types.ObjectId.isValid(String(courseId))) {
    return null;
  }

  return Course.findOne({
    _id: courseId,
    $or: [
      { status: 'published' },
      { status: { $exists: false }, publishStatus: 'published', approvalStatus: 'approved' }
    ]
  });
}

function isCoursePublishable(course: any) {
  if (course?.status) {
    return course.status === 'published';
  }
  return course?.approvalStatus === 'approved' && course?.publishStatus === 'published';
}

module.exports = {
  getMissingPrerequisiteIds,
  getPublishedCourseById,
  isCoursePublishable
};

export {};
