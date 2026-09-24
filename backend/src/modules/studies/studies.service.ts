import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
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
export class StudiesService {
  constructor(
    @Inject(STUDY_REPOSITORY) private readonly studies: StudyRepository,
    @Inject(ML_CLIENT) private readonly mlClient: MlClient,
    private readonly fileStorage: FileStorageService,
  ) {}

  async create(file: UploadedFile | undefined): Promise<CreateStudyResponseDto> {
    this.assertFile(file);

    const id = randomUUID();
    const now = new Date().toISOString();
    const storedFilePath = await this.fileStorage.save(id, file.originalname, file.buffer);

    const study: StudyRecord = {
      id,
      status: StudyStatus.Processing,
      originalFileName: file.originalname,
      storedFilePath,
      createdAt: now,
      updatedAt: now,
      error: null,
      result: null,
      processingTime: null,
    };

    await this.studies.save(study);
    void this.processStudy(id);

    return {
      id: study.id,
      status: study.status,
      createdAt: study.createdAt,
    };
  }

  async getById(id: string): Promise<StudyStatusResponseDto> {
    const study = await this.requireStudy(id);

    return {
      id: study.id,
      status: study.status,
      originalFileName: study.originalFileName,
      createdAt: study.createdAt,
      updatedAt: study.updatedAt,
      error: study.error,
      hasResult: study.status === StudyStatus.Completed && study.result !== null,
      processingTime: study.processingTime,
    };
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
      ...(study.result.quality_prob !== undefined
        ? { quality_prob: study.result.quality_prob }
        : {}),
      ...(study.result.anatomical_region
        ? { anatomical_region: study.result.anatomical_region }
        : {}),
    };
  }

  private assertFile(file: UploadedFile | undefined): asserts file is UploadedFile {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Файл исследования не передан. Ожидается поле multipart/form-data с именем file.',
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
    const startedAt = Date.now();

    const study = await this.studies.findById(id);
    if (!study) {
      return;
    }

    try {
      const result = await this.mlClient.analyze({
        studyId: study.id,
        filePath: study.storedFilePath,
        originalFileName: study.originalFileName,
      });

      study.result = result;
      study.status = StudyStatus.Completed;
      study.error = null;
      study.processingTime = (Date.now() - startedAt) / 1000;
    } catch {
      study.status = StudyStatus.Error;
      study.error = 'Ошибка обработки ML.';
      study.result = null;
      study.processingTime = (Date.now() - startedAt) / 1000;
    }

    study.updatedAt = new Date().toISOString();
    await this.studies.save(study);
  }

  async getAll(): Promise<StudyStatusResponseDto[]> {
    const studies = await this.studies.findAll();
    
    return studies.map(study => ({
      id: study.id,
      status: study.status,
      originalFileName: study.originalFileName,
      createdAt: study.createdAt,
      updatedAt: study.updatedAt,
      error: study.error,
      hasResult: study.status === StudyStatus.Completed && study.result !== null,
      processingTime: study.processingTime,
    }));
  }
}
