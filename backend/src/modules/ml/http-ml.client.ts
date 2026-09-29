import { Injectable, Logger } from '@nestjs/common';
import path from 'path';
import { MlAnalyzeInput, MlClient, MlPrediction } from './ml.types';

@Injectable()
export class HttpMlClient implements MlClient {
  private readonly logger = new Logger(HttpMlClient.name);

  async analyze(input: MlAnalyzeInput): Promise<MlPrediction> {
    const timeoutMs = positiveInt(process.env.ML_TIMEOUT_MS, 180_000);
    const url = `${this.baseUrl()}/analyze`;
    const heatmapPath = path.join(path.dirname(input.filePath), 'heatmap.png');

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dicom_path: input.filePath,
          heatmap_path: heatmapPath,
        }),
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

    return this.toPrediction(parsed);
  }

  private baseUrl(): string {
    const configured = process.env.ML_SERVICE_URL ?? 'http://127.0.0.1:8000';
    return configured.replace(/\/+$/, '');
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

    return {
      quality_class,
      violation_type,
      anatomical_region,
    };
  }
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
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
