import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  type ValidationError,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorCode } from '../types/api.contract.js';

/**
 * One error shape for every v1 route (programs, enrollments, assignments):
 *   { statusCode, code, message, details? }
 * `details` (field -> message) is present only for VALIDATION_FAILED.
 * The codes are listed in src/types/api.contract.ts and assignments.admin.contract.ts.
 */
export type ApiErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, string>;
};

/** Error with a contract code. Throw it from services; ApiExceptionFilter renders it. */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message, status);
  }
}

const STATUS_BY_API_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  SLUG_TAKEN: HttpStatus.CONFLICT,
  PROGRAM_HAS_ENROLLMENTS: HttpStatus.CONFLICT,
  CONTENT_HAS_SUBMISSIONS: HttpStatus.CONFLICT,
  NODE_TYPE_LOCKED: HttpStatus.CONFLICT,
  ENROLLMENT_CLOSED: HttpStatus.CONFLICT,
  PROGRAM_FULL: HttpStatus.CONFLICT,
  ALREADY_ENROLLED: HttpStatus.CONFLICT,
  INVALID_STATUS_TRANSITION: HttpStatus.CONFLICT,
  QUIZ_HAS_ATTEMPTS: HttpStatus.CONFLICT,
  QUIZ_NOT_READY: HttpStatus.CONFLICT,
  MAX_ATTEMPTS_REACHED: HttpStatus.CONFLICT,
  SUBMISSION_LOCKED: HttpStatus.CONFLICT,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  PHONE_TAKEN: HttpStatus.CONFLICT,
  CANNOT_MODIFY_SELF: HttpStatus.CONFLICT,
  LAST_SUPER_ADMIN: HttpStatus.CONFLICT,
  FILE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  UNSUPPORTED_FILE_TYPE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** Error for an api.contract.ts code, with the HTTP status the contract gives it. */
export function apiError(code: ApiErrorCode, message: string, details?: Record<string, string>): ApiException {
  return new ApiException(STATUS_BY_API_CODE[code], code, message, details);
}

/** Message per code when a plain Nest HttpException (guards, Multer) reaches the filter. */
const CODE_BY_STATUS: Record<number, { code: string; message: string }> = {
  [HttpStatus.BAD_REQUEST]: { code: 'VALIDATION_FAILED', message: 'One or more fields are invalid.' },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'You are not allowed to perform this action.' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'Not found.' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: { code: 'FILE_TOO_LARGE', message: 'File is larger than the allowed size.' },
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: { code: 'UNSUPPORTED_FILE_TYPE', message: 'File type is not supported.' },
  [HttpStatus.TOO_MANY_REQUESTS]: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests; try again later.' },
};

/**
 * Global ValidationPipe exceptionFactory. Keeps Nest's usual body (`message` is still
 * a string[], so existing clients such as the auth screens keep working) and adds a
 * `details` map that ApiExceptionFilter turns into VALIDATION_FAILED details.
 */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const details: Record<string, string> = {};
  const messages: string[] = [];
  const walk = (list: ValidationError[], prefix: string) => {
    for (const error of list) {
      const path = prefix ? `${prefix}.${error.property}` : error.property;
      const texts = Object.values(error.constraints ?? {});
      if (texts.length) {
        details[path] ??= texts[0];
        messages.push(...texts);
      }
      if (error.children?.length) walk(error.children, path);
    }
  };
  walk(errors, '');
  return new BadRequestException({ statusCode: 400, message: messages, error: 'Bad Request', details });
}

/**
 * Renders every error on the routes it is applied to as ApiErrorBody, including
 * guard, ValidationPipe and Multer errors. Unknown errors become INTERNAL_ERROR and
 * are logged, never leaked.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiError');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof ApiException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const known = CODE_BY_STATUS[statusCode];
      const response = exception.getResponse();
      const details =
        typeof response === 'object' && response !== null && 'details' in response
          ? (response.details as Record<string, string>)
          : undefined;
      if (known) {
        const message = statusCode === HttpStatus.BAD_REQUEST ? firstMessage(response) ?? known.message : known.message;
        return { statusCode, code: known.code, message, ...(details ? { details } : {}) };
      }
      if (statusCode < 500) {
        return { statusCode, code: 'VALIDATION_FAILED', message: exception.message };
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'Internal server error.' };
  }
}

function firstMessage(response: string | object): string | undefined {
  if (typeof response === 'string') return response;
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) return message.length ? String(message[0]) : undefined;
  return typeof message === 'string' ? message : undefined;
}
