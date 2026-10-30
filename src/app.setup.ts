import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { validationExceptionFactory } from './common/api-errors.js';
import { corsOrigins } from './config/env.validation.js';

/** App-wide middleware and pipes, shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication) {
  const production = process.env.NODE_ENV === 'production';

  // Behind a reverse proxy (nginx, a PaaS), trust its X-Forwarded-For so rate limits
  // see the real client IP. TRUST_PROXY=1 (one proxy hop) or a value Express accepts.
  if (process.env.TRUST_PROXY) {
    const value = process.env.TRUST_PROXY;
    app.getHttpAdapter().getInstance().set('trust proxy', /^\d+$/.test(value) ? Number(value) : value === 'true' || value);
  }

  // Security headers. Files (receipts, attachments) are fetched by the dashboard from
  // another origin, so allow cross-origin reads of resources.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // COOKIE_SECRET is required at startup (src/config/env.validation.ts).
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // DTO validation. Errors keep Nest's `message: string[]` and add a `details` map
  // (field -> message) that the v1 routes return as VALIDATION_FAILED details.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // CORS for the web dashboard and Expo web (native apps send no Origin and are not
  // affected). Production: only CORS_ORIGINS (required there). Development: any origin
  // unless CORS_ORIGINS is set.
  const allowed = corsOrigins(process.env.CORS_ORIGINS);
  if (!allowed && !production) {
    new Logger('Cors').warn('CORS_ORIGINS is not set: every origin is allowed (development only).');
  }
  app.enableCors({
    origin: allowed ?? !production,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });
}
