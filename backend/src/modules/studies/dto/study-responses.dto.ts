import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudyStatus } from '../study.types';

export class CreateStudyResponseDto {
  @ApiProperty({ example: '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21' })
  id!: string;

  @ApiProperty({ enum: StudyStatus, example: StudyStatus.Processing })
  status!: StudyStatus;

  @ApiProperty({ example: '2026-09-18T11:21:00.000Z' })
  createdAt!: string;
}

export class StudyStatusResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: StudyStatus })
  status!: StudyStatus;

  @ApiProperty({ example: 'spine.dcm' })
  originalFileName!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional({
  description: 'Время обработки исследования в секундах.',
  nullable: true,
  example: 1.25,
  })
  processingTime!: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Заполнено, если status = error' })
  error!: string | null;

  @ApiProperty({ description: 'true, если анализ завершён и доступен GET .../result' })
  hasResult!: boolean;
}

export class StudyResultResponseDto {
  @ApiProperty()
  studyId!: string;

  @ApiProperty({ enum: [0, 1], description: '0 - корректное изображение, 1 - нарушение качества' })
  quality_class!: 0 | 1;

  @ApiProperty({
    description: 'Типы нарушений через «;». Пустая строка, если нарушений нет.',
    example: '',
  })
  violation_type!: string;

  @ApiPropertyOptional({
    description: 'Вероятность нарушения [0; 1].',
    example: 0.05,
  })
  quality_prob?: number;

  @ApiPropertyOptional({
    example: 'Поясничный отдел позвоночника',
    description: 'Поясничный отдел позвоночника или Проксимальный отдел бедра.',
  })
  anatomical_region?: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ example: 'FILE_REQUIRED' })
  code!: string;

  @ApiProperty({ example: 'Файл исследования не передан.' })
  message!: string;

  @ApiPropertyOptional({ description: 'Текущий статус исследования, если ошибка связана с жизненным циклом' })
  status?: string;
}
