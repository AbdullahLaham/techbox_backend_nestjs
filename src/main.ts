import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Enable cookie parser
  app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie-secret'));

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration (crucial when using cookies with Expo/React Native or web clients)
  app.enableCors({
    origin: true,
    credentials: true,
  });


  await app.listen(5000);
}
await bootstrap();
