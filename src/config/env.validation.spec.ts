import { corsOrigins, validateEnv } from './env.validation.js';

const secret = 'x'.repeat(32);
const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_ACCESS_SECRET: secret, COOKIE_SECRET: secret };

describe('validateEnv', () => {
  it('accepts a complete development environment', () => {
    expect(validateEnv(base)).toBe(base);
  });

  it('refuses missing or short secrets, naming them without their values', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: undefined })).toThrow(/JWT_ACCESS_SECRET is required/);
    expect(() => validateEnv({ ...base, COOKIE_SECRET: 'short-cookie' })).toThrow(/COOKIE_SECRET .* at least 24/);
    try {
      validateEnv({ ...base, COOKIE_SECRET: 'short-cookie' });
    } catch (e) {
      expect(String(e)).not.toContain('short-cookie');
    }
  });

  it('requires storage, public URL and CORS origins in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /STORAGE_SIGNING_SECRET[\s\S]*PUBLIC_API_URL[\s\S]*CORS_ORIGINS/,
    );
    expect(
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        STORAGE_SIGNING_SECRET: secret,
        PUBLIC_API_URL: 'https://api.example.com',
        CORS_ORIGINS: 'https://dashboard.example.com',
      }),
    ).toBeTruthy();
  });

  it('checks PORT', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
    expect(validateEnv({ ...base, PORT: '5000' })).toBeTruthy();
  });
});

describe('corsOrigins', () => {
  it('splits and trims the list', () => {
    expect(corsOrigins(' https://a.example , http://localhost:3000 ,')).toEqual(['https://a.example', 'http://localhost:3000']);
    expect(corsOrigins('')).toBeUndefined();
    expect(corsOrigins(undefined)).toBeUndefined();
  });
});
