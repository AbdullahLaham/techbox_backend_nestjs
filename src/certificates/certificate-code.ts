import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L: codes are read aloud and typed by hand. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** "TB-XXXX-XXXX": 8 random characters, about 39 bits, from a cryptographic source. */
export function newCertificateCode(): string {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `TB-${pick()}-${pick()}`;
}

/** What a person types ("tb 7k3m 9qx2", "TB7K3M9QX2") to the stored form; null if it cannot be a code. */
export function normalizeCertificateCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const body = raw.startsWith('TB') ? raw.slice(2) : raw;
  if (body.length !== 8 || [...body].some((c) => !ALPHABET.includes(c))) return null;
  return `TB-${body.slice(0, 4)}-${body.slice(4)}`;
}
