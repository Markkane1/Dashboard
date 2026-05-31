const Course = require('./Course');
const Lesson = require('./Lesson');
const Progress = require('./Progress');
const QuizSubmission = require('./QuizSubmission');
const User = require('./User');
const Enrollment = require('./Enrollment');
const CertificateIssuance = require('./CertificateIssuance');
const Notification = require('./Notification');

module.exports = {
  Course,
  Lesson,
  Progress,
  QuizSubmission,
  User,
  Enrollment,
  CertificateIssuance,
  Notification
};

export {
  CertificateIssuance,
  Course,
  Enrollment,
  Lesson,
  Notification,
  Progress,
  QuizSubmission,
  User
};

export default {
  CertificateIssuance,
  Course,
  Enrollment,
  Lesson,
  Notification,
  Progress,
  QuizSubmission,
  User
};
