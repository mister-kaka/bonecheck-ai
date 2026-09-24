import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FileStorageService } from './file-storage.service';
import { isAllowedDicomUpload, MAX_FILE_SIZE_BYTES } from './file-validation';
import { ML_CLIENT, MlClient } from '../ml/ml.types';
import {
  STUDY_REPOSITORY,
  StudyRecord,
  StudyRepository,
  StudyStatus,
} from './study.types';
import {
  CreateStudyResponseDto,
  StudyListResponseDto,
  StudyResultResponseDto,
  StudyStatusResponseDto,
} from './dto/study-responses.dto';

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class StudiesService implements OnModuleInit {
  private readonly logger = new Logger(StudiesService.name);

  constructor(
    @Inject(STUDY_REPOSITORY) private readonly studies: StudyRepository,
    @Inject(ML_CLIENT) private readonly mlClient: MlClient,
    private readonly fileStorage: FileStorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    const studies = await this.studies.findAll();
    for (const study of studies) {
      if (study.status === StudyStatus.Processing) {
        void this.processStudy(study.id);
      }
    }
  }

  async create(
    file: UploadedFile | undefined,
    sessionId?: unknown,
  ): Promise<CreateStudyResponseDto> {
    this.assertFile(file);
    const normalizedSessionId = this.normalizeSessionId(sessionId);

    const id = randomUUID();
    const now = new Date().toISOString();
    const storedFilePath = await this.fileStorage.save(id, file.originalname, file.buffer);

    const study: StudyRecord = {
      id,
      sessionId: normalizedSessionId,
      status: StudyStatus.Processing,
      originalFileName: file.originalname,
      storedFilePath,
      createdAt: now,
      updatedAt: now,
      error: null,
      result: null,
    };

    await this.studies.save(study);
    void this.processStudy(id);

    return {
      id: study.id,
      status: study.status,
      createdAt: study.createdAt,
      sessionId: study.sessionId,
    };
  }

  async list(sessionId?: unknown): Promise<StudyListResponseDto> {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    const studies = await this.studies.findAll(normalizedSessionId ?? undefined);

    return {
      items: studies.map((study) => this.toStatus(study)),
    };
  }

  async getById(id: string): Promise<StudyStatusResponseDto> {
    return this.toStatus(await this.requireStudy(id));
  }

  async getResult(id: string): Promise<StudyResultResponseDto> {
    const study = await this.requireStudy(id);

    if (study.status === StudyStatus.Error) {
      throw new ConflictException({
        code: 'ANALYSIS_FAILED',
        message: study.error ?? 'Анализ исследования завершился с ошибкой.',
        status: study.status,
      });
    }

    if (study.status !== StudyStatus.Completed || !study.result) {
      throw new ConflictException({
        code: 'RESULT_NOT_READY',
        message: 'Результат анализа ещё не готов.',
        status: study.status,
      });
    }

return {
      studyId: study.id,
      quality_class: study.result.quality_class,
      violation_type: study.result.violation_type,
      anatomical_region: study.result.anatomical_region as string, // Прямо указываем, что это строка
      ...(study.result.quality_prob !== undefined
        ? { quality_prob: study.result.quality_prob }
        : {}),
    };
  }

  private assertFile(file: UploadedFile | undefined): asserts file is UploadedFile {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Файл исследования не передан. Ожидается поле формы с именем file.',
      });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Файл слишком большой. Максимальный размер - 50 МБ.',
      });
    }

    if (!file.buffer || file.size === 0) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Файл исследования пустой.',
      });
    }

    if (!isAllowedDicomUpload(file.originalname, file.mimetype)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'Некорректный формат файла. Ожидается DICOM (.dcm / .dicom).',
      });
    }
  }

  private normalizeSessionId(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_SESSION_ID',
        message: 'session_id должен быть строкой.',
      });
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.length > 128) {
      throw new BadRequestException({
        code: 'INVALID_SESSION_ID',
        message: 'session_id слишком длинный. Максимум 128 символов.',
      });
    }

    return trimmed;
  }

  private toStatus(study: StudyRecord): StudyStatusResponseDto {
    return {
      id: study.id,
      sessionId: study.sessionId,
      status: study.status,
      originalFileName: study.originalFileName,
      createdAt: study.createdAt,
      updatedAt: study.updatedAt,
      error: study.error,
      hasResult: study.status === StudyStatus.Completed && study.result !== null,
    };
  }

  private async requireStudy(id: string): Promise<StudyRecord> {
    const study = await this.studies.findById(id);

    if (!study) {
      throw new NotFoundException({
        code: 'STUDY_NOT_FOUND',
        message: 'Исследование не найдено.',
      });
    }

    return study;
  }

  private async processStudy(id: string): Promise<void> {
    try {
      const study = await this.studies.findById(id);
      if (!study || study.status !== StudyStatus.Processing) {
        return;
      }

      try {
        const result = await this.mlClient.analyze({
          studyId: study.id,
          filePath: study.storedFilePath,
          originalFileName: study.originalFileName,
        });

       this.validateMlResult(result);

        study.result = result;
        study.status = StudyStatus.Completed;
        study.error = null;
      } catch {
        study.status = StudyStatus.Error;
        study.error = 'Ошибка обработки ML.';
        study.result = null;
      }

      const current = await this.studies.findById(id);
      if (!current || current.status !== StudyStatus.Processing) {
        return;
      }

      study.updatedAt = new Date().toISOString();
      await this.studies.save(study);
    } catch (error) {
      this.logger.error(
        `Failed to process study ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

private validateMlResult(result: unknown): void {

if (!result || typeof result !== 'object' || Array.isArray(result)) {
  throw new Error('Ответ ML не является объектом');
}

    const { quality_class, violation_type, anatomical_region, quality_prob } = result as any;

    // Structural validation
    if (quality_class !== 0 && quality_class !== 1) {
      throw new Error('Некорректный quality_class');
    }
    if (typeof violation_type !== 'string') {
      throw new Error('violation_type должен быть строкой');
    }
    if (typeof anatomical_region !== 'string') {
      throw new Error('anatomical_region обязателен');
    }
    
    if (quality_prob !== undefined && quality_prob !== null) {
      if (
        typeof quality_prob !== 'number' ||
        !Number.isFinite(quality_prob) ||
        quality_prob < 0 ||
        quality_prob > 1
      ) {
        throw new Error('quality_prob должен быть числом от 0 до 1');
      }
    }

    const validRegions = ['Поясничный отдел позвоночника', 'Проксимальный отдел бедра'];
    if (!validRegions.includes(anatomical_region)) {
      throw new Error('Неизвестный anatomical_region');
    }

    if (quality_class === 0) {
      if (violation_type !== '') {
        throw new Error('При quality_class = 0 строка violation_type должна быть пустой');
      }
    } else {
      if (violation_type === '') {
        throw new Error('При quality_class = 1 строка violation_type не может быть пустой');
      }

      const violations = violation_type.split(';');
      const validSpine = ['Некорректная укладка', 'Не выравнена ось позвоночника', 'Присутствуют посторонние предметы'];
      const validHip = ['Некорректная укладка', 'Некорректная область интереса'];
      const allowedViolations = anatomical_region === 'Поясничный отдел позвоночника' ? validSpine : validHip;

      const seen = new Set<string>();
      for (const v of violations) {
        if (v === '') throw new Error('Пустой фрагмент нарушения');
        if (seen.has(v)) throw new Error('Дублирование нарушения');
        if (!allowedViolations.includes(v)) throw new Error('Нарушение не соответствует региону');
        seen.add(v);
      }
    }
  }
}