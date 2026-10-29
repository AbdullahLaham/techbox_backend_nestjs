import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { validationExceptionFactory } from './common/api-errors.js';

/** App-wide middleware and pipes, shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication) {
  app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie-secret'));

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

  // CORS (needed for the Next.js dashboard and Expo web).
  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });
}
