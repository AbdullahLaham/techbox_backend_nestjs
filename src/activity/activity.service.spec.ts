import { ActivityService, activityBucket } from './activity.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('activityBucket', () => {
  it('floors to the 15-minute window in UTC', () => {
    expect(activityBucket(new Date('2026-11-09T10:14:59.999Z')).toISOString()).toBe('2026-11-09T10:00:00.000Z');
    expect(activityBucket(new Date('2026-11-09T10:15:00.000Z')).toISOString()).toBe('2026-11-09T10:15:00.000Z');
    expect(activityBucket(new Date('2026-11-09T23:59:00.000Z')).toISOString()).toBe('2026-11-09T23:45:00.000Z');
  });

  it('never splits a local day, even for :30 and :45 offsets', () => {
    // 18:29 UTC is 23:59 in India (UTC+5:30); 18:30 UTC is already the next day there.
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
    const before = new Date('2026-11-09T18:29:00Z');
    const after = new Date('2026-11-09T18:30:00Z');
    expect(fmt.format(activityBucket(before))).toBe(fmt.format(before));
    expect(fmt.format(activityBucket(after))).toBe(fmt.format(after));
    const nepal = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }); // UTC+5:45
    const late = new Date('2026-11-09T18:14:00Z');
    expect(nepal.format(activityBucket(late))).toBe(nepal.format(late));
  });
});

describe('ActivityService.record', () => {
  it('never throws, so it cannot fail the student action', async () => {
    const prisma = { learningActivity: { createMany: () => Promise.reject(new Error('db down')) } } as unknown as PrismaService;
    await expect(new ActivityService(prisma).record('u1')).resolves.toBeUndefined();
  });
});
