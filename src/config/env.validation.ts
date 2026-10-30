/**
 * Environment check, run once at startup (ConfigModule.forRoot({ validate })).
 * The app refuses to start with a missing or weak secret instead of silently using a
 * default that anyone could guess and use to forge tokens.
 */

/** Secrets must be long random strings, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. */
export const MIN_SECRET_LENGTH = 24;

const ALWAYS_REQUIRED_SECRETS = ['JWT_ACCESS_SECRET', 'COOKIE_SECRET'] as const;
/** Production also needs stable file links and an explicit list of allowed web origins. */
const PRODUCTION_REQUIRED = ['STORAGE_SIGNING_SECRET', 'PUBLIC_API_URL', 'CORS_ORIGINS'] as const;

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const str = (key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');

  if (!str('DATABASE_URL')) errors.push('DATABASE_URL is required.');

  for (const key of ALWAYS_REQUIRED_SECRETS) {
    if (str(key).length < MIN_SECRET_LENGTH) {
      errors.push(`${key} is required and must be at least ${MIN_SECRET_LENGTH} characters.`);
    }
  }

  if (str('NODE_ENV') === 'production') {
    for (const key of PRODUCTION_REQUIRED) {
      if (!str(key)) errors.push(`${key} is required when NODE_ENV=production.`);
    }
    if (str('STORAGE_SIGNING_SECRET') && str('STORAGE_SIGNING_SECRET').length < MIN_SECRET_LENGTH) {
      errors.push(`STORAGE_SIGNING_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
    }
  }

  const port = str('PORT');
  if (port && !(Number.isInteger(Number(port)) && Number(port) > 0 && Number(port) < 65536)) {
    errors.push('PORT must be a number between 1 and 65535.');
  }

  if (errors.length) {
    // Names only, never values.
    throw new Error(`Invalid environment:\n - ${errors.join('\n - ')}`);
  }
  return env;
}

/** CORS_ORIGINS="https://dashboard.example.com,http://localhost:3000" -> list; empty -> undefined. */
export function corsOrigins(value: string | undefined): string[] | undefined {
  const list = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
}
