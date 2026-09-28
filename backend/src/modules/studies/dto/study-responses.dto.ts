import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudyStatus } from '../types/study.types';

export class CreateStudyResponseDto {
  @ApiProperty({ example: '3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21' })
  id!: string;

  @ApiProperty({
    enum: [StudyStatus.Processing],
    example: StudyStatus.Processing,
  })
  status!: StudyStatus;

  @ApiProperty({ example: '2026-09-18T11:21:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    nullable: true,
    description: 'Технический идентификатор браузерной сессии. Не user id.',
    example: '6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44',
  })
  sessionId!: string | null;
}

export class StudyStatusResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    nullable: true,
    description: 'Технический идентификатор браузерной сессии. Не user id.',
  })
  sessionId!: string | null;

  @ApiProperty({
    enum: [StudyStatus.Processing, StudyStatus.Completed, StudyStatus.Error],
  })
  status!: StudyStatus;

  @ApiProperty({ example: 'spine.dcm' })
  originalFileName!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({
    nullable: true,
    description: 'Заполнено, если статус равен «error»',
  })
  error!: string | null;

  @ApiProperty({ description: 'Истина, если анализ завершён и результат можно запросить' })
  hasResult!: boolean;
}

export class PackageStudyCreatedDto extends CreateStudyResponseDto {
  @ApiProperty({ example: 'spine.dcm' })
  originalFileName!: string;
}

export class CreatePackageResponseDto {
  @ApiProperty({ type: [PackageStudyCreatedDto] })
  items!: PackageStudyCreatedDto[];
}

export class StudyListResponseDto {
  @ApiProperty({ type: [StudyStatusResponseDto] })
  items!: StudyStatusResponseDto[];
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
    description: 'Вероятность нарушения [0; 1]. Ключ отсутствует, если ML его не вернул.',
    example: 0.05,
    minimum: 0,
    maximum: 1,
  })
  quality_prob?: number;

  @ApiProperty({
    example: 'Поясничный отдел позвоночника',
    enum: ['Поясничный отдел позвоночника', 'Проксимальный отдел бедра'],
    description: 'Обязательный регион успешного результата.',
  })
  anatomical_region!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'BAD REQUEST' })
  error!: string;

  @ApiProperty({ example: 'FILE_REQUIRED' })
  code!: string;

  @ApiProperty({ example: 'Файл исследования не передан.' })
  message!: string;

  @ApiPropertyOptional({ description: 'Текущий статус исследования, если ошибка связана с жизненным циклом' })
  status?: string;
}
