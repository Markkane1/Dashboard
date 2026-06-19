const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../src/server/server');
const User = require('../../src/server/models/User').default || require('../../src/server/models/User');
const Course = require('../../src/server/models/Course').default || require('../../src/server/models/Course');
const Enrollment = require('../../src/server/models/Enrollment').default || require('../../src/server/models/Enrollment');
const Assignment = require('../../src/server/models/Assignment').default || require('../../src/server/models/Assignment');
const AssignmentSubmission = require('../../src/server/models/AssignmentSubmission').default || require('../../src/server/models/AssignmentSubmission');
const { connectDB, disconnectDB, generateToken } = require('../integration/setup');

// Mock audit logging
jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('File Upload Security Integration Tests', () => {
  let userA;
  let userB;
  let tokenA;
  let tokenB;
  let course;
  let assignment;

  beforeAll(async () => {
    await connectDB();

    // Create users
    userA = await User.create({
      name: 'User A Student',
      email: 'usera-student@example.com',
      password: 'Password123!',
      role: 'student',
      roles: ['student'],
      permissions: [],
      status: 'active',
      emailVerified: true
    });

    userB = await User.create({
      name: 'User B Student',
      email: 'userb-student@example.com',
      password: 'Password123!',
      role: 'student',
      roles: ['student'],
      permissions: [],
      status: 'active',
      emailVerified: true
    });

    // Create tokens
    tokenA = generateToken(userA);
    tokenB = generateToken(userB);

    // Create course
    course = await Course.create({
      title: 'Security Course',
      description: 'Course for file upload security testing',
      category: 'Science',
      price: 0,
      publishStatus: 'published',
      approvalStatus: 'approved',
      trainerIds: [],
      instructorId: userA._id, // User A as mock instructor or student
      status: 'published'
    });

    // Enroll User A and User B in the course
    await Enrollment.create({
      userId: userA._id,
      courseId: course._id,
      status: 'active'
    });

    await Enrollment.create({
      userId: userB._id,
      courseId: course._id,
      status: 'active'
    });

    // Create a published assignment
    assignment = await Assignment.create({
      courseId: course._id,
      title: 'File Upload Audit Assignment',
      instructions: 'Please submit your files.',
      status: 'published'
    });
  }, 20000);

  afterAll(async () => {
    await disconnectDB();
  }, 20000);

  // Helper to generate JPEG with custom metadata script
  function createMockJpgWithScript() {
    const soi = Buffer.from([0xFF, 0xD8]);
    const app1Marker = Buffer.from([0xFF, 0xE1]);
    const scriptStr = '<script>alert("hacked")</script>';
    const payload = Buffer.concat([
      Buffer.from('Exif\0\0'),
      Buffer.from(scriptStr)
    ]);
    const len = payload.length + 2;
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16BE(len, 0);

    const eoi = Buffer.from([0xFF, 0xD9]);

    return Buffer.concat([soi, app1Marker, lenBuf, payload, eoi]);
  }

  /* -------------------------------------------------------------------------- */
  /*                            1. FILE TYPE BYPASS                             */
  /* -------------------------------------------------------------------------- */
  describe('1. File Type Bypass Checks', () => {
    it('should allow renaming PHP/JS disguised as JPEG and store it safely without execution', async () => {
      const phpPayload = Buffer.from('<?php echo "evil"; ?>');
      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', phpPayload, 'image.jpg')
        .field('text', 'Disguised PHP script');

      expect(res.status).toBe(201);
      expect(res.body.fileUrl).toBeDefined();

      // Verify download is served as attachment
      const submissionId = res.body.id;
      const downloadRes = await request(app)
        .get(`/api/assignments/submissions/${submissionId}/file`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-disposition']).toContain('attachment');
    });

    it('should allow renaming HTML disguised as PDF and store it safely without execution', async () => {
      const htmlPayload = Buffer.from('<html><body><script>alert(1)</script></body></html>');
      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', htmlPayload, 'document.pdf')
        .field('text', 'Disguised HTML document');

      expect(res.status).toBe(201);
      expect(res.body.fileUrl).toBeDefined();
    });

    it('should reject file with double extension ending in executable (e.g., malware.jpg.exe)', async () => {
      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', Buffer.from('executable content'), 'malware.jpg.exe')
        .field('text', 'Double extension upload');

      expect(res.status).toBe(400);
    });

    it('should reject file with double extension containing executable inner part (e.g., malware.exe.jpg)', async () => {
      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', Buffer.from('executable content'), 'malware.exe.jpg')
        .field('text', 'Double extension upload');

      expect(res.status).toBe(400);
    });

    it('should reject file with no extension', async () => {
      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', Buffer.from('some text'), 'noextension')
        .field('text', 'No extension upload');

      expect(res.status).toBe(400);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                          2. MALICIOUS FILE CONTENT                         */
  /* -------------------------------------------------------------------------- */
  describe('2. Malicious File Content EXIF Stripping', () => {
    it('should strip script tags from JPEG EXIF metadata on upload', async () => {
      const jpgWithMetadata = createMockJpgWithScript();

      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', jpgWithMetadata, 'image.jpg')
        .field('text', 'Image containing script in EXIF');

      expect(res.status).toBe(201);

      const submissionId = res.body.id;
      const downloadRes = await request(app)
        .get(`/api/assignments/submissions/${submissionId}/file`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(downloadRes.status).toBe(200);
      // Verify the script tag has been completely stripped out of the image payload
      expect(downloadRes.body.toString()).not.toContain('<script>');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                             3. FILE SIZE LIMITS                            */
  /* -------------------------------------------------------------------------- */
  describe('3. File Size Limits', () => {
    it('should reject uploads exceeding the configured limit (25MB)', async () => {
      // Allocate a buffer just over 25MB (26MB)
      const oversizedBuffer = Buffer.alloc(26 * 1024 * 1024);

      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', oversizedBuffer, 'oversized.pdf')
        .field('text', 'Oversized file upload');

      expect(res.status).toBe(413);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                          4. PATH TRAVERSAL IN FILENAME                      */
  /* -------------------------------------------------------------------------- */
  describe('4. Path Traversal in Filename Sanitization', () => {
    it('should sanitize filename ../../etc/image.jpg to avoid traversal and store safely', async () => {
      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', Buffer.from('passwd dummy content'), '../../etc/image.jpg')
        .field('text', 'Path traversal filename');

      expect(res.status).toBe(201);
      expect(res.body.fileName).not.toContain('..');
      expect(res.body.fileName).not.toContain('/');
      expect(res.body.fileName).not.toContain('\\');
      expect(res.body.fileUrl).not.toContain('..');

      // Make sure the file was saved correctly without escaping directory
      const submission = await AssignmentSubmission.findById(res.body.id);
      expect(submission.fileUrl).toBeDefined();
      const storedFileName = path.basename(submission.fileUrl);
      expect(storedFileName).not.toContain('..');
      expect(storedFileName).not.toContain('/');
      expect(storedFileName).not.toContain('\\');
    });

    it('should sanitize filename ../document.pdf to avoid traversal and store safely', async () => {
      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', Buffer.from('server dummy content'), '../document.pdf')
        .field('text', 'Path traversal filename');

      expect(res.status).toBe(201);
      expect(res.body.fileName).not.toContain('..');
      expect(res.body.fileUrl).not.toContain('..');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                            5. DIRECT FILE URL ACCESS                       */
  /* -------------------------------------------------------------------------- */
  describe('5. Direct File URL Access Control', () => {
    it('should reject file downloads if not the owner or authorized reviewer', async () => {
      // 1. Upload a private submission as User A
      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', Buffer.from('private document'), 'private.pdf')
        .field('text', 'My private submission');

      expect(res.status).toBe(201);
      const submissionId = res.body.id;

      // 2. Attempt to fetch User A's file authenticated as User B
      const unauthorizedRes = await request(app)
        .get(`/api/assignments/submissions/${submissionId}/file`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(unauthorizedRes.status).toBe(403);
      expect(unauthorizedRes.body.error).toBe('Access denied.');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                            6. EXECUTABLE UPLOAD                            */
  /* -------------------------------------------------------------------------- */
  describe('6. Executable Upload Rejection', () => {
    const dangerousExtensions = ['.js', '.sh', '.php', '.py', '.exe'];

    dangerousExtensions.forEach((ext) => {
      it(`should reject files with extension ${ext}`, async () => {
        const res = await request(app)
          .post(`/api/assignments/${assignment._id}/submissions`)
          .set('Authorization', `Bearer ${tokenA}`)
          .attach('file', Buffer.from('executable payload'), `payload${ext}`)
          .field('text', `Dangerous extension ${ext}`);

        expect(res.status).toBe(400);
      });
    });
  });
});
