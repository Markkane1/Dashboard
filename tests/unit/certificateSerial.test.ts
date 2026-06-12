import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCertificateModel } = vi.hoisted(() => {
  return {
    mockCertificateModel: {
      countDocuments: vi.fn()
    }
  };
});

vi.mock('../../src/server/models', () => {
  return {
    CertificateIssuance: mockCertificateModel
  };
});

// Import the service under test
import { generateCertificateSerial } from '../../src/server/services/certificateSerial';

describe('Certificate Serial Generator Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate serial using normalized category and sequence count (happy path)', async () => {
    mockCertificateModel.countDocuments.mockResolvedValue(4); // sequence will be 4 + 1 = 5

    const course = { category: 'biodiversity', title: 'Biodiversity Course' };
    const date = new Date('2026-06-11T12:00:00Z');

    const serial = await generateCertificateSerial(course, date);

    expect(serial).toBe('EPA-CKEPD-2026-BIODIVER-000005');
    expect(mockCertificateModel.countDocuments).toHaveBeenCalledWith({
      issuedAt: {
        $gte: new Date(Date.UTC(2026, 0, 1)),
        $lt: new Date(Date.UTC(2027, 0, 1))
      }
    });
  });

  it('should fallback to title if category is empty/null/undefined (happy path fallback)', async () => {
    mockCertificateModel.countDocuments.mockResolvedValue(0);

    const courseNoCat = { category: '', title: 'Climate Change 101' };
    const date = new Date('2025-01-15T00:00:00Z');

    const serial = await generateCertificateSerial(courseNoCat, date);
    expect(serial).toBe('EPA-CKEPD-2025-CLIMATEC-000001');
  });

  it('should normalize special characters, spaces, and slice to 8 characters', async () => {
    mockCertificateModel.countDocuments.mockResolvedValue(10);

    const course = { category: 'Water & Sanitation #2026!' };
    const date = new Date(2026, 11, 31, 12, 0, 0); // Dec 31, 2026 local time

    const serial = await generateCertificateSerial(course, date);
    // 'Water & Sanitation #2026!' -> uppercase -> 'WATER & SANITATION #2026!'
    // replace non-alphanumeric -> 'WATERSANITATION2026'
    // slice(0, 8) -> 'WATERSAN'
    expect(serial).toBe('EPA-CKEPD-2026-WATERSAN-000011');
  });

  it('should use fallback COURSE when both category and title are empty or missing', async () => {
    mockCertificateModel.countDocuments.mockResolvedValue(99);

    const emptyCourse = { category: '', title: '' };
    const date = new Date('2026-02-28T12:00:00Z');

    const serial = await generateCertificateSerial(emptyCourse, date);
    expect(serial).toBe('EPA-CKEPD-2026-COURSE-000100');
  });

  it('should handle unexpected course formats (edge case)', async () => {
    mockCertificateModel.countDocuments.mockResolvedValue(0);

    expect(await generateCertificateSerial(null, new Date('2026-01-01'))).toBe('EPA-CKEPD-2026-COURSE-000001');
    expect(await generateCertificateSerial(undefined, new Date('2026-01-01'))).toBe('EPA-CKEPD-2026-COURSE-000001');
    expect(await generateCertificateSerial({}, new Date('2026-01-01'))).toBe('EPA-CKEPD-2026-COURSE-000001');
  });

  it('should handle unexpected types in course fields (edge case)', async () => {
    mockCertificateModel.countDocuments.mockResolvedValue(0);

    const badCourse = { category: 12345, title: true };
    const date = new Date('2026-01-01');

    expect(await generateCertificateSerial(badCourse as any, date)).toBe('EPA-CKEPD-2026-12345-000001');
  });

  it('should handle default date if issuedAt is omitted (happy path default)', async () => {
    mockCertificateModel.countDocuments.mockResolvedValue(0);

    const currentYear = new Date().getFullYear();
    const course = { category: 'test' };

    const serial = await generateCertificateSerial(course);
    expect(serial).toBe(`EPA-CKEPD-${currentYear}-TEST-000001`);
  });

  it('should propagate model count errors (error path)', async () => {
    mockCertificateModel.countDocuments.mockRejectedValue(new Error('Count query failed'));

    await expect(generateCertificateSerial({ category: 'test' })).rejects.toThrow('Count query failed');
  });
});
