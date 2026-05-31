import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
// Standalone seed/cleanup utility; intentionally connects to MongoDB outside Next.js runtime.
// eslint-disable-next-line no-restricted-imports
import mongoose from 'mongoose';
import { connectMongo } from '../src/server/db/mongoose';
import models from '../src/server/models';
import { USER_ROLES } from '../src/shared/permissions';
const { logger } = require('../src/server/logger');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const {
  CertificateIssuance,
  Course,
  Enrollment,
  Lesson,
  Notification: DemoNotification,
  Progress,
  QuizSubmission,
  User
} = models;

const DEMO_KEY = 'demo-content-v1';

type CourseSeed = {
  key: string;
  title: string;
  description: string;
  category: string;
  sdgGoals: number[];
  topics: string[];
  mea: string[];
  duration: string;
  instructorName: string;
  isDiploma?: boolean;
  requiredKeys?: string[];
  lessons?: Array<{
    title: string;
    description: string;
    order: number;
    duration: number;
    videoUrl: string;
    transcript: string;
  }>;
};

type SeededCourse = {
  _id: {
    toString(): string;
  };
};

const courses: CourseSeed[] = [
  {
    key: 'climate-governance',
    title: 'Demo: Climate Governance and the Paris Agreement',
    description: 'A complete demo course with lessons, video metadata, progress, quiz questions, and completion analytics.',
    category: 'climate-atmosphere',
    sdgGoals: [13, 16, 17],
    topics: ['mea-introductory'],
    mea: ['UNFCCC', 'Paris Agreement'],
    duration: '3 hours',
    instructorName: 'Demo Faculty',
    lessons: [
      {
        title: 'Paris Agreement foundations',
        description: 'How nationally determined contributions connect to treaty implementation.',
        order: 1,
        duration: 420,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        transcript: 'Demo transcript: introduction to Paris Agreement architecture, ambition cycles, and reporting duties.'
      },
      {
        title: 'Transparency and compliance',
        description: 'Follow the enhanced transparency framework from reporting to review.',
        order: 2,
        duration: 510,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        transcript: 'Demo transcript: transparency, review, facilitative compliance, and implementation support.'
      }
    ]
  },
  {
    key: 'biodiversity-access-benefit',
    title: 'Demo: Biodiversity, Access, and Benefit Sharing',
    description: 'A CBD/Nagoya Protocol course demonstrating catalog filters, lesson publishing, and quiz authoring.',
    category: 'biological-diversity',
    sdgGoals: [15, 16],
    topics: ['mea-introductory', 'human-rights'],
    mea: ['CBD', 'Nagoya Protocol'],
    duration: '2.5 hours',
    instructorName: 'Demo Biodiversity Unit',
    lessons: [
      {
        title: 'CBD institutions and national focal points',
        description: 'Map the CBD institutional structure and implementation cycle.',
        order: 1,
        duration: 390,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        transcript: 'Demo transcript: CBD bodies, national focal points, and reporting structures.'
      },
      {
        title: 'Prior informed consent in practice',
        description: 'Apply access and benefit-sharing safeguards to a practical case.',
        order: 2,
        duration: 480,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        transcript: 'Demo transcript: PIC, MAT, community safeguards, and benefit sharing.'
      }
    ]
  },
  {
    key: 'chemicals-waste-controls',
    title: 'Demo: Chemicals and Waste Compliance Toolkit',
    description: 'A BRS-focused demo course with published lessons and a final quiz.',
    category: 'chemicals-waste',
    sdgGoals: [3, 12],
    topics: ['gender'],
    mea: ['Basel Convention', 'Rotterdam Convention', 'Stockholm Convention'],
    duration: '2 hours',
    instructorName: 'Demo Waste Secretariat',
    lessons: [
      {
        title: 'Hazardous waste movement controls',
        description: 'Understand notification, consent, and environmentally sound management.',
        order: 1,
        duration: 360,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        transcript: 'Demo transcript: prior informed consent and movement documentation.'
      },
      {
        title: 'POPs and national implementation plans',
        description: 'Review Stockholm Convention planning requirements.',
        order: 2,
        duration: 450,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        transcript: 'Demo transcript: POPs inventories, phase-out measures, and implementation plans.'
      }
    ]
  },
  {
    key: 'environmental-law-diploma',
    title: 'Demo Diploma: Environmental Law Implementation Specialist',
    description: 'A removable demo diploma track that requires completion of the demo climate and biodiversity courses.',
    category: 'environmental-governance',
    sdgGoals: [13, 15, 16, 17],
    topics: ['mea-introductory'],
    mea: ['UNFCCC', 'CBD', 'BRS'],
    duration: 'Diploma pathway',
    instructorName: 'Demo Diploma Board',
    isDiploma: true,
    requiredKeys: ['climate-governance', 'biodiversity-access-benefit']
  }
];

function quizQuestions(prefix: string) {
  return [
    {
      id: `${prefix}-q1`,
      prompt: 'What does this demo course primarily test?',
      options: ['Understanding of course concepts', 'Video upload speed', 'Password reset flow', 'Server startup logs'],
      correctAnswerIndex: 0,
      explanation: 'The final quiz checks learning outcomes for the course.'
    },
    {
      id: `${prefix}-q2`,
      prompt: 'When should learners take the final quiz?',
      options: ['After completing lessons', 'Before opening the course', 'Only after deleting content', 'Before enrollment'],
      correctAnswerIndex: 0,
      explanation: 'Quiz access is intended after lesson completion.'
    }
  ];
}

async function removeDemoData() {
  const demoCourses = await Course.find({ demoKey: DEMO_KEY }).select('_id');
  const demoUsers = await User.find({ demoKey: DEMO_KEY }).select('_id');
  const courseIds = demoCourses.map((course: { _id: unknown }) => course._id);
  const userIds = demoUsers.map((user: { _id: unknown }) => user._id);

  await Promise.all([
    CertificateIssuance.deleteMany({ courseId: { $in: courseIds } }),
    QuizSubmission.deleteMany({ $or: [{ demoKey: DEMO_KEY }, { courseId: { $in: courseIds } }, { userId: { $in: userIds } }] }),
    Progress.deleteMany({ $or: [{ demoKey: DEMO_KEY }, { courseId: { $in: courseIds } }, { userId: { $in: userIds } }] }),
    Enrollment.deleteMany({ $or: [{ demoKey: DEMO_KEY }, { courseId: { $in: courseIds } }, { userId: { $in: userIds } }] }),
    DemoNotification.deleteMany({ $or: [{ demoKey: DEMO_KEY }, { userId: { $in: userIds } }] }),
    Lesson.deleteMany({ $or: [{ demoKey: DEMO_KEY }, { courseId: { $in: courseIds } }] }),
    Course.deleteMany({ demoKey: DEMO_KEY }),
    User.deleteMany({ demoKey: DEMO_KEY })
  ]);
}

async function seedDemoData() {
  await removeDemoData();

  const password = await bcrypt.hash('DemoPass123!', 12);
  const [, instructor, learner] = await User.insertMany([
    {
      name: 'Demo Admin',
      email: 'demo.admin@example.com',
      password,
      role: USER_ROLES.ADMIN,
      emailVerified: true,
      demoKey: DEMO_KEY
    },
    {
      name: 'Demo Instructor',
      email: 'demo.instructor@example.com',
      password,
      role: USER_ROLES.INSTRUCTOR,
      emailVerified: true,
      demoKey: DEMO_KEY
    },
    {
      name: 'Demo Learner',
      email: 'demo.learner@example.com',
      password,
      role: USER_ROLES.STUDENT,
      emailVerified: true,
      demoKey: DEMO_KEY
    }
  ]);

  const createdCourses = new Map<string, SeededCourse>();
  for (const seed of courses.filter((course) => !course.isDiploma)) {
    const course = await Course.create({
      title: seed.title,
      description: seed.description,
      category: seed.category,
      sdgGoals: seed.sdgGoals,
      topics: seed.topics,
      mea: seed.mea,
      instructorId: String(instructor._id),
      instructorName: seed.instructorName,
      price: 0,
      thumbnail: '',
      duration: seed.duration,
      lessonsCount: seed.lessons?.length || 0,
      rating: 4.8,
      enrolledCount: 1,
      quizPassingScore: 70,
      quizQuestions: quizQuestions(seed.key),
      demoKey: DEMO_KEY
    });
    createdCourses.set(seed.key, course);

    await Lesson.insertMany((seed.lessons || []).map((lesson) => ({
      ...lesson,
      courseId: course._id,
      resources: [
        { label: 'Demo syllabus', url: `/courses/${course._id}` },
        { label: 'Reference checklist', url: '/about' }
      ],
      isPublished: true,
      demoKey: DEMO_KEY
    })));
  }

  for (const seed of courses.filter((course) => course.isDiploma)) {
    const requiredIds = (seed.requiredKeys || [])
      .map((key) => createdCourses.get(key)?._id?.toString())
      .filter(Boolean);

    const diploma = await Course.create({
      title: seed.title,
      description: seed.description,
      category: seed.category,
      sdgGoals: seed.sdgGoals,
      topics: seed.topics,
      mea: seed.mea,
      instructorId: String(instructor._id),
      instructorName: seed.instructorName,
      price: 0,
      duration: seed.duration,
      lessonsCount: 0,
      rating: 5,
      enrolledCount: 1,
      isDiploma: true,
      diplomaRequiredCourseIds: requiredIds,
      quizPassingScore: 70,
      quizQuestions: quizQuestions(seed.key),
      demoKey: DEMO_KEY
    });
    createdCourses.set(seed.key, diploma);
  }

  const lessons = await Lesson.find({ demoKey: DEMO_KEY }).sort({ order: 1 });
  const completedCourse = createdCourses.get('climate-governance');
  const inProgressCourse = createdCourses.get('biodiversity-access-benefit');
  const diplomaCourse = createdCourses.get('environmental-law-diploma');
  if (!completedCourse || !inProgressCourse || !diplomaCourse) {
    throw new Error('Demo course seeding failed before enrollments could be created.');
  }

  await Enrollment.insertMany([
    { userId: learner._id, courseId: completedCourse._id, completed: true, completedAt: new Date(), demoKey: DEMO_KEY },
    { userId: learner._id, courseId: inProgressCourse._id, completed: false, demoKey: DEMO_KEY },
    { userId: learner._id, courseId: diplomaCourse._id, completed: false, demoKey: DEMO_KEY }
  ]);

  await Progress.insertMany(lessons
    .filter((lesson: { courseId: unknown }) => [completedCourse._id.toString(), inProgressCourse._id.toString()].includes(String(lesson.courseId)))
    .map((lesson: { _id: unknown; courseId: unknown; duration?: number }, index: number) => ({
      userId: learner._id,
      courseId: lesson.courseId,
      lessonId: lesson._id,
      watchedSeconds: String(lesson.courseId) === String(completedCourse._id) ? lesson.duration || 1 : index === 2 ? 180 : 0,
      duration: lesson.duration || 1,
      completed: String(lesson.courseId) === String(completedCourse._id),
      lastWatchedAt: new Date(Date.now() - index * 60 * 60 * 1000),
      demoKey: DEMO_KEY
    })));

  await QuizSubmission.create({
    userId: learner._id,
    courseId: completedCourse._id,
    answers: [
      { questionId: 'climate-governance-q1', selectedOptionIndex: 0 },
      { questionId: 'climate-governance-q2', selectedOptionIndex: 0 }
    ],
    score: 100,
    totalQuestions: 2,
    passed: true,
    demoKey: DEMO_KEY
  });

  await DemoNotification.create({
    userId: learner._id,
    type: 'course',
    title: 'Demo course progress ready',
    message: 'Your demo learner account has enrollments, progress, a passed quiz, and a pending diploma requirement.',
    linkUrl: '/dashboard',
    demoKey: DEMO_KEY
  });

  logger.info('Demo data seeded.');
  logger.info('Accounts:');
  logger.info('  demo.admin@example.com / DemoPass123!');
  logger.info('  demo.instructor@example.com / DemoPass123!');
  logger.info('  demo.learner@example.com / DemoPass123!');
}

async function main() {
  const command = process.argv[2] || 'seed';
  await connectMongo();

  if (command === 'remove') {
    await removeDemoData();
    logger.info('Demo data removed.');
  } else if (command === 'seed') {
    await seedDemoData();
  } else {
    throw new Error(`Unknown command "${command}". Use "seed" or "remove".`);
  }

  await mongoose.connection.close();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Seed script failed');
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});

export {};
