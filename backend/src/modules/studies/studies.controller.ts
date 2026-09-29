import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Head,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import {
  ExportStudiesQueryDto,
  ListStudiesQueryDto,
  SubmissionQueryDto,
} from './dto/study-requests.dto';
import {
  ApiErrorResponseDto,
  CreatePackageResponseDto,
  CreateStudyResponseDto,
  StudyListResponseDto,
  StudyResultResponseDto,
  StudyStatusResponseDto,
} from './dto/study-responses.dto';
import { MAX_FILE_SIZE_BYTES } from './storage/file-validation';
import { StudiesService } from './studies.service';
import { XLSX_CONTENT_TYPE } from './export/xlsx-workbook';

const studyIdPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () =>
    new BadRequestException({
      code: 'BAD_REQUEST',
      message: 'Идентификатор исследования должен быть UUID v4.',
    }),
});

@ApiTags('studies')
@Controller('api/studies')
export class StudiesController {
  constructor(private readonly studiesService: StudiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создать исследование',
    description:
      'Принимает один DICOM-файл, создаёт исследование и запускает проверку качества укладки.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'DICOM-файл исследования (.dcm / .dicom)',
        },
        session_id: {
          type: 'string',
          description:
            'Технический идентификатор браузерной сессии из localStorage. Не user id. Необязателен.',
          example: '6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: CreateStudyResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    type: ApiErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      defParamCharset: 'utf8',
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('session_id') sessionId?: string,
  ): Promise<CreateStudyResponseDto> {
    return this.studiesService.create(file, sessionId);
  }

  @Post('packages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Загрузить ZIP с DICOM',
    description:
      'Принимает один ZIP. Каждый DICOM внутри становится отдельным исследованием. Архив не распаковывается в файловую систему по путям из архива.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'ZIP-архив с файлами .dcm / .dicom',
        },
        session_id: {
          type: 'string',
          description:
            'Технический идентификатор браузерной сессии из localStorage. Не user id. Необязателен.',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: CreatePackageResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    type: ApiErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      defParamCharset: 'utf8',
    }),
  )
  createPackage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('session_id') sessionId?: string,
  ): Promise<CreatePackageResponseDto> {
    return this.studiesService.createPackage(file, sessionId);
  }

  @Get()
  @ApiOperation({
    summary: 'Список исследований',
    description:
      'Без session_id возвращает общую историю. С session_id возвращает исследования этой браузерной сессии.',
  })
  @ApiQuery({
    name: 'session_id',
    required: false,
    description:
      'Технический идентификатор браузерной сессии. Не user id. Пустое значение равносильно отсутствию фильтра.',
    example: '6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44',
  })
  @ApiOkResponse({ type: StudyListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  list(@Query() query: ListStudiesQueryDto): Promise<StudyListResponseDto> {
    return this.studiesService.list(query.session_id);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Выгрузить исследования в XLSX',
    description:
      'Без ids выгружает список (все или сессию session_id). С ids выгружает только эти исследования. Пустой список даёт файл с одной строкой заголовков.',
  })
  @ApiQuery({
    name: 'ids',
    required: false,
    description: 'UUID v4 через запятую. Если параметр задан, session_id не фильтрует выборку.',
  })
  @ApiQuery({
    name: 'session_id',
    required: false,
    description: 'Сессия «Мои», если ids не передан.',
  })
  @ApiOkResponse({
    description: 'Файл XLSX',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async exportXlsx(
    @Query() query: ExportStudiesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.studiesService.exportXlsx(query);
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return new StreamableFile(file.body);
  }

  @Get('submission')
  @ApiOperation({
    summary: 'Файл результата по контракту ТЗ',
    description:
      'Одна строка — одно изображение. Колонки: path_to_study, study_uid, image_uid, anatomical_region, quality_class, violation_type, processing_status, time_of_processing. Это не журнал истории.',
  })
  @ApiQuery({
    name: 'ids',
    required: false,
    description: 'UUID v4 через запятую. Если параметр задан, session_id выборку не фильтрует.',
  })
  @ApiQuery({
    name: 'session_id',
    required: false,
    description: 'Сессия «Мои», если ids не передан.',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'xlsx по умолчанию или csv.',
    enum: ['xlsx', 'csv'],
  })
  @ApiOkResponse({
    description: 'Файл .xlsx или .csv',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
      'text/csv': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async exportSubmission(
    @Query() query: SubmissionQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.studiesService.exportSubmission(query);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return new StreamableFile(file.body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить статус исследования' })
  @ApiOkResponse({ type: StudyStatusResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getById(
    @Param('id', studyIdPipe) id: string,
  ): Promise<StudyStatusResponseDto> {
    return this.studiesService.getById(id);
  }

  @Get(':id/result')
  @ApiOperation({ summary: 'Получить результат анализа' })
  @ApiOkResponse({ type: StudyResultResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  getResult(
    @Param('id', studyIdPipe) id: string,
  ): Promise<StudyResultResponseDto> {
    return this.studiesService.getResult(id);
  }

  @Get(':id/file')
  @ApiOperation({
    summary: 'Скачать DICOM исследования',
    description:
      'Отдаёт файл, сохранённый для этого исследования. Путь на диске в ответ не входит.',
  })
  @ApiOkResponse({
    description: 'DICOM-файл',
    content: {
      'application/dicom': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async getFile(
    @Param('id', studyIdPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.studiesService.getFile(id);
    res.setHeader('Content-Type', 'application/dicom');
    res.setHeader('Content-Disposition', contentDisposition(file.filename));
    return new StreamableFile(file.body);
  }

  @Head(':id/heatmap')
  @ApiOperation({ summary: 'Проверить, что тепловая карта есть' })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async headHeatmap(
    @Param('id', studyIdPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.studiesService.getHeatmap(id);
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(file.body.length));
    res.setHeader('Cache-Control', 'no-store');
    res.end();
  }

  @Get(':id/heatmap')
  @ApiOperation({
    summary: 'Получить тепловую карту исследования',
    description:
      'PNG, сохранённый рядом с DICOM. Если файла нет, исследование и текстовый результат не меняются.',
  })
  @ApiOkResponse({
    description: 'PNG тепловой карты',
    content: {
      'image/png': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async getHeatmap(
    @Param('id', studyIdPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.studiesService.getHeatmap(id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(file.body);
  }
}

function contentDisposition(filename: string): string {
  const cleaned = filename.replace(/[\r\n"]/g, '_');
  const ascii = cleaned.replace(/[^\x20-\x7E]/g, '_') || 'study.dcm';
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}
