import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ListStudiesQueryDto } from './dto/study-requests.dto';
import {
  ApiErrorResponseDto,
  CreateStudyResponseDto,
  StudyListResponseDto,
  StudyResultResponseDto,
  StudyStatusResponseDto,
} from './dto/study-responses.dto';
import { MAX_FILE_SIZE_BYTES } from './file-validation';
import { StudiesService } from './studies.service';

@ApiTags('studies')
@Controller('api/studies')
export class StudiesController {
  constructor(private readonly studiesService: StudiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создать исследование',
    description:
      'Принимает один DICOM-файл, создаёт идентификатор и запускает анализ (сейчас заглушка ML).',
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('session_id') sessionId?: string,
  ): Promise<CreateStudyResponseDto> {
    return this.studiesService.create(file, sessionId);
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

  @Get(':id')
  @ApiOperation({ summary: 'Получить статус исследования' })
  @ApiOkResponse({ type: StudyStatusResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<StudyStatusResponseDto> {
    return this.studiesService.getById(id);
  }

  @Get(':id/result')
  @ApiOperation({ summary: 'Получить результат анализа' })
  @ApiOkResponse({ type: StudyResultResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  getResult(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<StudyResultResponseDto> {
    return this.studiesService.getResult(id);
  }
}
