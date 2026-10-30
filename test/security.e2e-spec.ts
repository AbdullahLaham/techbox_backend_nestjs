/**
 * Security hardening (docs/updates/04-security-and-production.md): headers and login rate limits.
 * Uses the test database (no data is wiped here; it only tries logins for unknown emails).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);

describe.skipIf(!dbName.endsWith('_test'))('Security (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('sends security headers and lets the dashboard read files cross-origin', async () => {
    const res = await http().get('/v1/programs').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('limits login attempts per email, with Retry-After', async () => {
    const attempt = (email: string) => http().post('/auth/login').send({ email, password: 'wrong-password-123' });

    for (let i = 0; i < 10; i++) await attempt('Target@E2E.test').expect(401);
    // Case does not matter: the 11th try on the same account is refused.
    const blocked = await attempt('target@e2e.test').expect(429);
    expect(blocked.body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    // Another account from the same address still works until the per-IP limit (30).
    await attempt('other@e2e.test').expect(401);
  });

  it('limits login attempts per IP across many emails', async () => {
    // 11 attempts so far from this address (10 + 1 above, the refused one not counted).
    let status = 401;
    let tries = 0;
    while (status === 401 && tries < 40) {
      status = (await http().post('/auth/login').send({ email: `user${tries}@e2e.test`, password: 'wrong-password-123' })).status;
      tries++;
    }
    expect(status).toBe(429);
    expect(tries).toBe(20); // 11 + 19 = 30 allowed, the next one refused
  });
});
