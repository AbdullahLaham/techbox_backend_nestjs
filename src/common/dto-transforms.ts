import { Transform } from 'class-transformer';

/** Trims strings; leaves other values for the validators to reject. */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Trims strings and turns "" into null, so optional text fields can be cleared. */
export const TrimToNull = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
