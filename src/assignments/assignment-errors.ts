import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  AssignmentErrorBody,
  AssignmentErrorCode,
} from '../types/assignments.admin.contract.js';

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

/** Error with a spec error code (ASSIGNMENTS_SPEC.md 5.2). */
export class AssignmentException extends HttpException {
  constructor(
    readonly code: AssignmentErrorCode,
    message?: string,
    readonly details?: Record<string, string>,
  ) {
    super(message ?? DEFAULT_MESSAGES[code], STATUS_BY_CODE[code]);
  }
}

export const validationFailed = (details: Record<string, string>) =>
  new AssignmentException('VALIDATION_FAILED', undefined, details);

const CODE_BY_STATUS: Record<number, AssignmentErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_FILE_TYPE',
};

/**
 * Renders every error on the assignment routes (including guard and Multer errors)
 * as `{ statusCode, code, message, details? }`. Unknown errors become INTERNAL_ERROR
 * and are logged, never leaked.
 */
@Catch()
export class AssignmentExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Assignments');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): AssignmentErrorBody {
    if (exception instanceof AssignmentException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const code = CODE_BY_STATUS[statusCode];
      if (code) {
        return { statusCode, code, message: DEFAULT_MESSAGES[code] };
      }
      if (statusCode < 500) {
        return { statusCode, code: 'VALIDATION_FAILED', message: exception.message };
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: DEFAULT_MESSAGES.INTERNAL_ERROR,
    };
  }
}
