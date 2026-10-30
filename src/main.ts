import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  configureApp(app);

  // PORT from the environment (checked at startup); 5000 is what the apps use in development.
  await app.listen(Number(process.env.PORT) || 5000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
await bootstrap();
