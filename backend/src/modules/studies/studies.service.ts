import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import path from 'path';
import { FileStorageService } from './storage/file-storage.service';
import { isAllowedDicomUpload, MAX_FILE_SIZE_BYTES } from './storage/file-validation';
import { ML_CLIENT, MlClient, MlPrediction } from '../ml/ml.types';
import {
  STUDY_REPOSITORY,
  StudyRecord,
  StudyRepository,
  StudyStatus,
} from './types/study.types';
import {
  CreatePackageResponseDto,
  CreateStudyResponseDto,
  StudyListResponseDto,
  StudyResultResponseDto,
  StudyStatusResponseDto,
} from './dto/study-responses.dto';
import {
  ExportStudiesQueryDto,
  SubmissionQueryDto,
} from './dto/study-requests.dto';
import { formatMoscowDateTime } from './export/moscow-time';
import {
  buildSubmissionCsv,
  buildTypedXlsx,
  buildXlsx,
  SheetCell,
  SUBMISSION_HEADERS,
  XLSX_CONTENT_TYPE,
  XLSX_HEADERS,
  xlsxDownloadName,
} from './export/xlsx-workbook';
import { readZipPackage, ZipPackageError } from './archive/zip-package';

type ValidMlPrediction = MlPrediction & {
  anatomical_region:
    'Поясничный отдел позвоночника' | 'Проксимальный отдел бедра';
};

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_LABEL: Record<StudyStatus, string> = {
  [StudyStatus.Uploaded]: 'Файл принят',
  [StudyStatus.Processing]: 'Идёт анализ',
  [StudyStatus.Completed]: 'Готово',
  [StudyStatus.Error]: 'Ошибка анализа',
};

export type XlsxFile = {
  filename: string;
  body: Buffer;
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
    return this.persistStudy(file, normalizedSessionId);
  }

  async createPackage(
    file: UploadedFile | undefined,
    sessionId?: unknown,
  ): Promise<CreatePackageResponseDto> {
    this.assertZipFile(file);
    const normalizedSessionId = this.normalizeSessionId(sessionId);

    let entries;
    try {
      entries = readZipPackage(file.buffer);
    } catch (error) {
      if (error instanceof ZipPackageError) {
        this.raiseZipError(error);
      }
      throw new BadRequestException({
        code: 'INVALID_ZIP',
        message: 'Архив повреждён или не является ZIP.',
      });
    }

    // Сводного заключения по пакету нет: каждый DICOM - отдельное исследование.
    const items = [];
    for (const entry of entries) {
      const created = await this.persistStudy(
        {
          originalname: entry.originalName,
          mimetype: 'application/dicom',
          size: entry.buffer.length,
          buffer: entry.buffer,
        },
        normalizedSessionId,
      );
      items.push({
        ...created,
        originalFileName: entry.originalName,
      });
    }

    return { items };
  }

  async exportXlsx(query: ExportStudiesQueryDto): Promise<XlsxFile> {
    const studies = await this.studiesForExport(query);
    const rows = [
      [...XLSX_HEADERS],
      ...studies.map((study) => this.toExportRow(study)),
    ];

    return {
      filename: xlsxDownloadName(studies.map((study) => study.originalFileName)),
      body: buildXlsx(rows),
    };
  }

  async exportSubmission(
    query: SubmissionQueryDto,
  ): Promise<XlsxFile & { contentType: string }> {
    const studies = await this.studiesForExport(query);
    const rows = [
      SUBMISSION_HEADERS.map((header) => ({ kind: 'text' as const, value: header })),
      ...studies.map((study) => this.toSubmissionRow(study)),
    ];
    const format = query.format ?? 'xlsx';

    if (format === 'csv') {
      return {
        filename: 'bonecheck-submission.csv',
        contentType: 'text/csv; charset=utf-8',
        body: buildSubmissionCsv(rows),
      };
    }

    return {
      filename: 'bonecheck-submission.xlsx',
      contentType: XLSX_CONTENT_TYPE,
      body: buildTypedXlsx(rows),
    };
  }

  async list(sessionId?: unknown): Promise<StudyListResponseDto> {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    const studies = await this.studies.findAll(
      normalizedSessionId ?? undefined,
    );

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

    if (
      study.status !== StudyStatus.Completed ||
      !this.isReadableResult(study.result)
    ) {
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
      anatomical_region: study.result.anatomical_region,
      ...(study.result.quality_prob !== undefined
        ? { quality_prob: study.result.quality_prob }
        : {}),
    };
  }

  async getFile(id: string): Promise<{ body: Buffer; filename: string }> {
    const study = await this.requireStudy(id);
    const body = await this.fileStorage.read(study.storedFilePath);
    if (!body) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'Файл исследования не найден.',
      });
    }

    return {
      body,
      filename: study.originalFileName,
    };
  }

  async getHeatmap(id: string): Promise<{ body: Buffer }> {
    const study = await this.requireStudy(id);
    const heatmapPath = path.join(path.dirname(study.storedFilePath), 'heatmap.png');
    const body = await this.fileStorage.read(heatmapPath);
    if (!body) {
      throw new NotFoundException({
        code: 'HEATMAP_NOT_FOUND',
        message: 'Тепловая карта для этого исследования не найдена.',
      });
    }

    return { body };
  }

  private async persistStudy(
    file: UploadedFile,
    sessionId: string | null,
  ): Promise<CreateStudyResponseDto> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const storedFilePath = await this.fileStorage.save(
      id,
      file.originalname,
      file.buffer,
    );

    const study: StudyRecord = {
      id,
      sessionId,
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

  private async studiesForExport(
    query: ExportStudiesQueryDto,
  ): Promise<StudyRecord[]> {
    if (query.ids !== undefined) {
      const ids = this.parseExportIds(query.ids);
      const studies: StudyRecord[] = [];
      for (const id of ids) {
        const study = await this.studies.findById(id);
        if (!study) {
          throw new NotFoundException({
            code: 'STUDY_NOT_FOUND',
            message: 'Исследование не найдено.',
          });
        }
        studies.push(study);
      }
      return studies;
    }

    const sessionId = this.normalizeSessionId(query.session_id);
    return this.studies.findAll(sessionId ?? undefined);
  }

  private parseExportIds(value: string): string[] {
    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length === 0) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Не указаны исследования для выгрузки.',
      });
    }

    if (parts.length > 200) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Слишком много исследований для одной выгрузки.',
      });
    }

    const ids: string[] = [];
    const seen = new Set<string>();
    for (const part of parts) {
      if (!UUID_V4.test(part)) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Идентификатор исследования должен быть UUID v4.',
        });
      }
      const id = part.toLowerCase();
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
    }

    return ids;
  }

  private toExportRow(study: StudyRecord): string[] {
    const result = this.isReadableResult(study.result) ? study.result : null;
    const probability =
      result && result.quality_prob !== undefined
        ? `${Math.round(result.quality_prob * 100)}%`
        : '';

    return [
      study.originalFileName,
      formatMoscowDateTime(study.createdAt),
      result?.anatomical_region ?? '',
      result ? (result.quality_class === 0 ? 'Корректно' : 'Нарушение') : '',
      result?.violation_type ?? '',
      probability,
      STATUS_LABEL[study.status],
    ];
  }

  private toSubmissionRow(study: StudyRecord): SheetCell[] {
    const result = this.isReadableResult(study.result) ? study.result : null;
    const success = study.status === StudyStatus.Completed && result !== null;

    return [
      { kind: 'text', value: study.originalFileName },
      { kind: 'text', value: study.studyUid ?? '' },
      { kind: 'text', value: study.imageUid ?? '' },
      { kind: 'text', value: result?.anatomical_region ?? '' },
      success
        ? { kind: 'number', value: result.quality_class }
        : { kind: 'text', value: '' },
      { kind: 'text', value: result?.violation_type ?? '' },
      { kind: 'text', value: success ? 'Success' : 'Failure' },
      typeof study.processingSeconds === 'number'
        ? { kind: 'number', value: study.processingSeconds }
        : { kind: 'text', value: '' },
    ];
  }

  private assertZipFile(
    file: UploadedFile | undefined,
  ): asserts file is UploadedFile {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Архив не передан. Ожидается поле формы с именем file.',
      });
    }

    if (
      file.size > MAX_FILE_SIZE_BYTES ||
      file.buffer.length > MAX_FILE_SIZE_BYTES
    ) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: 'Файл слишком большой. Максимальный размер - 50 МБ.',
      });
    }

    if (file.size === 0 || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Архив пустой.',
      });
    }

    if (!isZipUpload(file.originalname, file.mimetype)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'Некорректный формат файла. Ожидается ZIP-архив (.zip).',
      });
    }
  }

  private raiseZipError(error: ZipPackageError): never {
    const body = { code: error.code, message: error.message };
    if (error.statusCode === 413) {
      throw new PayloadTooLargeException(body);
    }
    throw new BadRequestException(body);
  }

  private assertFile(
    file: UploadedFile | undefined,
  ): asserts file is UploadedFile {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message:
          'Файл исследования не передан. Ожидается поле формы с именем file.',
      });
    }

    if (!file.buffer) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Файл исследования пустой.',
      });
    }

    if (
      file.size > MAX_FILE_SIZE_BYTES ||
      file.buffer.length > MAX_FILE_SIZE_BYTES
    ) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: 'Файл слишком большой. Максимальный размер - 50 МБ.',
      });
    }

    if (file.size === 0 || file.buffer.length === 0) {
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
      hasResult:
        study.status === StudyStatus.Completed &&
        this.isReadableResult(study.result),
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

  private isReadableResult(
    result: StudyRecord['result'],
  ): result is ValidMlPrediction {
    if (!result) {
      return false;
    }

    try {
      this.validateMlResult(result);
      return true;
    } catch {
      return false;
    }
  }

  private async processStudy(id: string): Promise<void> {
    try {
      const study = await this.studies.findById(id);
      if (!study || study.status !== StudyStatus.Processing) {
        return;
      }

      const started = Date.now();
      try {
        const result = await this.mlClient.analyze({
          studyId: study.id,
          filePath: study.storedFilePath,
          originalFileName: study.originalFileName,
        });

        this.validateMlResult(result);

        study.result = result;
        study.studyUid = result.study_uid ?? null;
        study.imageUid = result.image_uid ?? null;
        study.processingSeconds =
          typeof result.time_of_processing === 'number'
            ? result.time_of_processing
            : roundSeconds((Date.now() - started) / 1000);
        study.status = StudyStatus.Completed;
        study.error = null;
      } catch (error) {
        this.logger.error(
          `Ошибка обработки ML для исследования ${id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error.stack : undefined,
        );

        study.status = StudyStatus.Error;
        study.error = 'Не удалось проверить качество укладки.';
        study.result = null;
        study.studyUid = null;
        study.imageUid = null;
        study.processingSeconds = roundSeconds((Date.now() - started) / 1000);
      }

      study.updatedAt = new Date().toISOString();
      await this.studies.finishIfProcessing(study);
    } catch (error) {
      this.logger.error(
        `Не удалось сохранить итог исследования ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private validateMlResult(
    result: unknown,
  ): asserts result is ValidMlPrediction {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Ответ ML не является объектом');
    }

    const prediction = result as Record<string, unknown>;

    const { quality_class, violation_type, anatomical_region, quality_prob } =
      prediction;

    if (
      typeof quality_class !== 'number' ||
      !Number.isInteger(quality_class) ||
      (quality_class !== 0 && quality_class !== 1)
    ) {
      throw new Error('Некорректный quality_class');
    }

    if (typeof violation_type !== 'string') {
      throw new Error('violation_type должен быть строкой');
    }

    if (typeof anatomical_region !== 'string') {
      throw new Error('anatomical_region обязателен');
    }

    if (
      Object.prototype.hasOwnProperty.call(prediction, 'quality_prob') &&
      (typeof quality_prob !== 'number' ||
        !Number.isFinite(quality_prob) ||
        quality_prob < 0 ||
        quality_prob > 1)
    ) {
      throw new Error('quality_prob должен быть числом от 0 до 1');
    }

    const validRegions = [
      'Поясничный отдел позвоночника',
      'Проксимальный отдел бедра',
    ];

    if (!validRegions.includes(anatomical_region)) {
      throw new Error('Неизвестный anatomical_region');
    }

    if (quality_class === 0) {
      if (violation_type !== '') {
        throw new Error(
          'При quality_class = 0 строка violation_type должна быть пустой',
        );
      }

      return;
    }

    if (violation_type === '') {
      throw new Error(
        'При quality_class = 1 строка violation_type не может быть пустой',
      );
    }

    const violations = violation_type.split(';');

    const validSpine = [
      'Некорректная укладка',
      'Не выравнена ось позвоночника',
      'Присутствуют посторонние предметы',
    ];

    const validHip = ['Некорректная укладка', 'Некорректная область интереса'];

    const allowedViolations =
      anatomical_region === 'Поясничный отдел позвоночника'
        ? validSpine
        : validHip;

    const seen = new Set<string>();

    for (const violation of violations) {
      if (violation === '') {
        throw new Error('Пустой фрагмент нарушения');
      }

      if (seen.has(violation)) {
        throw new Error('Дублирование нарушения');
      }

      if (!allowedViolations.includes(violation)) {
        throw new Error('Нарушение не соответствует региону');
      }

      seen.add(violation);
    }
  }
}

function roundSeconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isZipUpload(originalName: string, mimeType: string): boolean {
  const lowerName = originalName.toLowerCase();
  const extension = lowerName.includes('.')
    ? lowerName.slice(lowerName.lastIndexOf('.'))
    : '';
  if (extension === '.zip') {
    return true;
  }

  const mime = (mimeType ?? '').toLowerCase();
  return mime === 'application/zip' || mime === 'application/x-zip-compressed';
}
