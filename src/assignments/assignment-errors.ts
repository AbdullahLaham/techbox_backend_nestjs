import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-errors.js';
import type { AssignmentErrorCode } from '../types/assignments.admin.contract.js';

const STATUS_BY_CODE: Record<AssignmentErrorCode, number> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  ASSIGNMENT_HAS_SUBMISSIONS: HttpStatus.CONFLICT,
  ALLOWED_TYPE_LOCKED: HttpStatus.CONFLICT,
  MAX_SCORE_BELOW_EXISTING_SCORES: HttpStatus.CONFLICT,
  INVALID_STATUS_TRANSITION: HttpStatus.CONFLICT,
  ATTACHMENT_LIMIT_REACHED: HttpStatus.CONFLICT,
  FILE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  UNSUPPORTED_FILE_TYPE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

const DEFAULT_MESSAGES: Record<AssignmentErrorCode, string> = {
  VALIDATION_FAILED: 'One or more fields are invalid.',
  UNAUTHORIZED: 'Authentication required.',
  FORBIDDEN: 'You are not allowed to perform this action.',
  NOT_FOUND: 'Not found.',
  ASSIGNMENT_HAS_SUBMISSIONS: 'Assignment has submissions; archive it instead.',
  ALLOWED_TYPE_LOCKED: 'allowedType cannot change once students have submitted.',
  MAX_SCORE_BELOW_EXISTING_SCORES: 'maxScore cannot be lower than an existing score.',
  INVALID_STATUS_TRANSITION: 'This action is not allowed in the current status.',
  ATTACHMENT_LIMIT_REACHED: 'Maximum number of files reached.',
  FILE_TOO_LARGE: 'File is larger than the allowed size.',
  UNSUPPORTED_FILE_TYPE: 'File type is not supported.',
  TOO_MANY_REQUESTS: 'Too many uploads; try again in a minute.',
  INTERNAL_ERROR: 'Internal server error.',
};

/** Error with an assignment error code (ASSIGNMENTS_SPEC.md 5.2). */
export class AssignmentException extends ApiException {
  declare readonly code: AssignmentErrorCode;

  constructor(code: AssignmentErrorCode, message?: string, details?: Record<string, string>) {
    super(STATUS_BY_CODE[code], code, message ?? DEFAULT_MESSAGES[code], details);
  }
}

export const validationFailed = (details: Record<string, string>) =>
  new AssignmentException('VALIDATION_FAILED', undefined, details);
