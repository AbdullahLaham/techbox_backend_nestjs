import 'dotenv/config';
import { defineConfig } from '@prisma/config';

export default defineConfig({
   migrations: {
      // Run by `npx prisma db seed`: creates the first admin accounts (see the file).
      seed: 'tsx prisma/seed.ts',
    },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});