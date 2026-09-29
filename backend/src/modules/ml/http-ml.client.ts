import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { MlAnalyzeInput, MlAnalyzeResult, MlClient, MlPrediction } from './ml.types';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

@Injectable()
export class HttpMlClient implements MlClient {
  private readonly logger = new Logger(HttpMlClient.name);

  async analyze(input: MlAnalyzeInput): Promise<MlAnalyzeResult> {
    const timeoutMs = positiveInt(process.env.ML_TIMEOUT_MS, 180_000);
    const url = `${this.baseUrl()}/analyze`;
    const bytes = await this.readDicom(input);
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(bytes)], { type: 'application/dicom' }),
      'study.dcm',
    );

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`ML service is unavailable for ${input.studyId}: ${message}`);
      throw new Error(`ML service unavailable: ${message}`);
    }

    const raw = await response.text();
    if (!response.ok) {
      this.logger.error(
        `ML service failed for ${input.studyId}: HTTP ${response.status} ${raw}`,
      );
      throw new Error(messageFromMl(response.status, raw));
    }

    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error('ML service returned invalid JSON');
    }

    const prediction = this.toPrediction(parsed);
    return {
      prediction,
      heatmapPng: this.readHeatmap(parsed as Record<string, unknown>, input.studyId),
    };
  }

  private async readDicom(input: MlAnalyzeInput): Promise<Buffer> {
    try {
      const bytes = await readFile(input.filePath);
      if (bytes.length === 0) {
        throw new Error('file is empty');
      }
      return bytes;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`DICOM is unreadable for ${input.studyId}: ${message}`);
      throw new Error(`DICOM is unreadable: ${message}`);
    }
  }

  private baseUrl(): string {
    const configured = process.env.ML_SERVICE_URL ?? 'http://127.0.0.1:8000';
    return configured.replace(/\/+$/, '');
  }

  private readHeatmap(body: Record<string, unknown>, studyId: string): Buffer | null {
    if (!Object.prototype.hasOwnProperty.call(body, 'heatmap_png') || body.heatmap_png == null) {
      return null;
    }
    const decoded = decodePngBase64(body.heatmap_png);
    if (!decoded) {
      this.logger.error(`ML heatmap is unusable for ${studyId}`);
      return null;
    }
    return decoded;
  }

  private toPrediction(value: unknown): MlPrediction {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('ML service returned an invalid result');
    }

    const body = value as Record<string, unknown>;
    const { quality_class, violation_type, anatomical_region } = body;

    if (quality_class !== 0 && quality_class !== 1) {
      throw new Error('ML service returned an invalid quality_class');
    }
    if (typeof violation_type !== 'string' || typeof anatomical_region !== 'string') {
      throw new Error('ML service returned an invalid result');
    }

    const prediction: MlPrediction = {
      quality_class,
      violation_type,
      anatomical_region,
    };

    if (typeof body.study_uid === 'string') {
      prediction.study_uid = body.study_uid;
    }
    if (typeof body.image_uid === 'string') {
      prediction.image_uid = body.image_uid;
    }
    if (
      typeof body.time_of_processing === 'number' &&
      Number.isFinite(body.time_of_processing) &&
      body.time_of_processing >= 0
    ) {
      prediction.time_of_processing = body.time_of_processing;
    }
    if (body.processing_status === 'Success' || body.processing_status === 'Failure') {
      prediction.processing_status = body.processing_status;
    }

    return prediction;
  }
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function decodePngBase64(value: unknown): Buffer | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const compact = value.replace(/\s+/g, '');
  if (compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    return null;
  }
  const decoded = Buffer.from(compact, 'base64');
  if (decoded.toString('base64') !== compact) {
    return null;
  }
  if (decoded.length < PNG_SIGNATURE.length || !decoded.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return null;
  }
  return decoded;
}

function messageFromMl(status: number, raw: string): string {
  try {
    const body = JSON.parse(raw) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) {
      return `ML service HTTP ${status}: ${body.error.trim()}`;
    }
  } catch {
    // Тело ошибки не JSON. Ниже остаётся код ответа.
  }
  return `ML service HTTP ${status}`;
}
