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

        return new BadRequestException(errors);
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
