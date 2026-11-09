import { IsOptional, IsString, MaxLength, Validate, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { HOME_DEFAULT_TIME_ZONE } from '../types/home.contract.js';

/** True for IANA names this runtime knows ("Asia/Gaza", "UTC"). */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

@ValidatorConstraint({ name: 'isTimeZone' })
class IsTimeZoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return isTimeZone(value);
  }
  defaultMessage() {
    return 'tz must be an IANA timezone name, e.g. Asia/Gaza';
  }
}

/** Query of GET /v1/home (HomeQuery). */
export class HomeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Validate(IsTimeZoneConstraint)
  tz: string = HOME_DEFAULT_TIME_ZONE;
}
