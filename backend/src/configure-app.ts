import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export function configureApp(app: INestApplication): void {
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const sessionError = errors.find((error) => error.property === 'session_id');
        if (sessionError?.constraints && 'isString' in sessionError.constraints) {
          return new BadRequestException({
            code: 'INVALID_SESSION_ID',
            message: 'session_id должен быть строкой.',
          });
        }

        const unknownParameter = errors.find(
          (error) => error.constraints && 'whitelistValidation' in error.constraints,
        );
        if (unknownParameter) {
          return new BadRequestException({
            code: 'BAD_REQUEST',
            message: 'Неизвестный параметр запроса.',
          });
        }

        return new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Некорректный запрос.',
        });
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
