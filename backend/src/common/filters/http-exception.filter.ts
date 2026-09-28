import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

type ErrorBody = {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  status?: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (this.isMulterError(exception)) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        return {
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          error: this.statusName(HttpStatus.PAYLOAD_TOO_LARGE),
          code: 'FILE_TOO_LARGE',
          message: 'Файл слишком большой. Максимальный размер - 50 МБ.',
        };
      }

      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: this.statusName(HttpStatus.BAD_REQUEST),
        code: 'INVALID_FILE',
        message: 'Не удалось принять файл исследования.',
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const raw = exception.getResponse();
      const payload = typeof raw === 'string' ? { message: raw } : raw;
      const record = payload as Record<string, unknown>;
      const message = this.publicMessage(
        statusCode,
        this.readMessage(record.message ?? record.msg) || exception.message,
      );

      return {
        statusCode,
        error: this.statusName(statusCode),
        code: typeof record.code === 'string' ? record.code : this.defaultCode(statusCode),
        message,
        ...(typeof record.status === 'string' ? { status: record.status } : {}),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: this.statusName(HttpStatus.INTERNAL_SERVER_ERROR),
      code: 'INTERNAL_ERROR',
      message: 'Не удалось обработать запрос. Попробуйте ещё раз.',
    };
  }

  private isMulterError(
    exception: unknown,
  ): exception is Error & { code: string; name: string } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'name' in exception &&
      (exception as { name: string }).name === 'MulterError'
    );
  }

  private publicMessage(statusCode: number, message: string): string {
    if (/^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.test(message)) {
      return statusCode === HttpStatus.NOT_FOUND
        ? 'Запрошенный адрес не найден.'
        : 'Не удалось обработать запрос. Попробуйте ещё раз.';
    }

    return message;
  }

  private readMessage(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.filter((item) => typeof item === 'string').join('; ');
    }

    return '';
  }

  private defaultCode(statusCode: number): string {
    if (statusCode === HttpStatus.NOT_FOUND) {
      return 'STUDY_NOT_FOUND';
    }

    if (statusCode === HttpStatus.BAD_REQUEST) {
      return 'BAD_REQUEST';
    }

    if (statusCode === HttpStatus.CONFLICT) {
      return 'CONFLICT';
    }

    if (statusCode === HttpStatus.PAYLOAD_TOO_LARGE) {
      return 'FILE_TOO_LARGE';
    }

    return 'HTTP_ERROR';
  }

  private statusName(statusCode: number): string {
    return HttpStatus[statusCode]?.replace(/_/g, ' ') ?? 'Error';
  }
}
