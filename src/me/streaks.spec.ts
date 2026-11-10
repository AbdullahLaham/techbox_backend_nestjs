import { activityDays } from './streaks.js';
import { newCertificateCode, normalizeCertificateCode } from '../certificates/certificate-code.js';

const at = (iso: string) => new Date(iso);

describe('activityDays', () => {
  const now = at('2026-11-10T10:00:00Z'); // Tuesday noon in Gaza (UTC+2)

  it('is empty without activity', () => {
    expect(activityDays(now, 'Asia/Gaza', [])).toEqual({ activeDays: 0, currentStreakDays: 0, longestStreakDays: 0 });
  });

  it('counts distinct local days, the longest run and the run up to today', () => {
    const result = activityDays(now, 'Asia/Gaza', [
      at('2026-11-01T08:00:00Z'), // run of 3: Nov 1-3
      at('2026-11-02T08:00:00Z'),
      at('2026-11-02T09:00:00Z'), // same day twice
      at('2026-11-03T08:00:00Z'),
      at('2026-11-08T08:00:00Z'), // run up to today: Nov 8-10
      at('2026-11-09T08:00:00Z'),
      at('2026-11-10T08:00:00Z'),
    ]);
    expect(result).toEqual({ activeDays: 6, currentStreakDays: 3, longestStreakDays: 3 });
  });

  it('keeps the current streak when today has no activity yet, and drops it after a missed day', () => {
    const upToYesterday = [at('2026-11-08T08:00:00Z'), at('2026-11-09T08:00:00Z')];
    expect(activityDays(now, 'Asia/Gaza', upToYesterday).currentStreakDays).toBe(2);
    expect(activityDays(at('2026-11-11T10:00:00Z'), 'Asia/Gaza', upToYesterday).currentStreakDays).toBe(0);
  });

  it('uses the local day: 22:30 UTC is already the next day in Gaza', () => {
    const result = activityDays(now, 'Asia/Gaza', [at('2026-11-08T22:30:00Z'), at('2026-11-10T08:00:00Z')]);
    // Nov 9 local and Nov 10 local: consecutive.
    expect(result).toMatchObject({ activeDays: 2, currentStreakDays: 2 });
  });
});

describe('certificate codes', () => {
  it('generates TB-XXXX-XXXX without ambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = newCertificateCode();
      expect(code).toMatch(/^TB-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
      expect(normalizeCertificateCode(code)).toBe(code);
    }
  });

  it('accepts what people type and rejects what cannot be a code', () => {
    expect(normalizeCertificateCode(' tb 7k3m-9qx2 ')).toBe('TB-7K3M-9QX2');
    expect(normalizeCertificateCode('7K3M9QX2')).toBe('TB-7K3M-9QX2');
    expect(normalizeCertificateCode('TB-7K3M-9QX')).toBeNull(); // too short
    expect(normalizeCertificateCode('TB-OOOO-1111')).toBeNull(); // O and 1 are never used
    expect(normalizeCertificateCode('')).toBeNull();
  });
});
