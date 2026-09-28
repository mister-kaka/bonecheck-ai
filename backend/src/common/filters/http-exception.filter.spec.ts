/// <reference types="jest" />
import { ArgumentsHost, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function capture(exception: unknown): { statusCode: number; body: Record<string, unknown> } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as ArgumentsHost;

  new HttpExceptionFilter().catch(exception, host);

  return {
    statusCode: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as Record<string, unknown>,
  };
}

describe('HttpExceptionFilter', () => {
  it('maps a multer size limit to 413 FILE_TOO_LARGE', () => {
    const error = new Error('File too large') as Error & { code: string };
    error.name = 'MulterError';
    error.code = 'LIMIT_FILE_SIZE';

    const response = capture(error);

    expect(response.statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(response.body).toEqual({
      statusCode: 413,
      error: 'PAYLOAD TOO LARGE',
      code: 'FILE_TOO_LARGE',
      message: 'Файл слишком большой. Максимальный размер - 50 МБ.',
    });
  });

  it('maps other multer errors to 400 INVALID_FILE', () => {
    const error = new Error('Unexpected field') as Error & { code: string };
    error.name = 'MulterError';
    error.code = 'LIMIT_UNEXPECTED_FILE';

    const response = capture(error);

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      error: 'BAD REQUEST',
      code: 'INVALID_FILE',
    });
  });

  it('hides internal error details from the client', () => {
    const response = capture(new Error('sqlite path C:\\secret\\bonecheck.sqlite'));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      statusCode: 500,
      error: 'INTERNAL SERVER ERROR',
      code: 'INTERNAL_ERROR',
      message: 'Не удалось обработать запрос. Попробуйте ещё раз.',
    });
  });

  it('does not return the framework route text for an unknown address', () => {
    const response = capture(
      new NotFoundException('Cannot GET /api/studies?session_id=secret'),
    );

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Запрошенный адрес не найден.');
    expect(JSON.stringify(response.body)).not.toContain('session_id');
    expect(JSON.stringify(response.body)).not.toContain('Cannot GET');
  });
});
