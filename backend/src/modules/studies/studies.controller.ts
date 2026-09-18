import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  ApiErrorResponseDto,
  CreateStudyResponseDto,
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
      'Принимает один DICOM-файл, создаёт идентификатор и запускает анализ (сейчас - mock ML).',
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
  ): Promise<CreateStudyResponseDto> {
    return this.studiesService.create(file);
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
