import { Injectable } from '@nestjs/common';
import { MlAnalyzeInput, MlAnalyzeResult, MlClient } from './ml.types';

// Фиксированный ответ, когда выбран ML_CLIENT=mock или процесс запущен на Render без ML_CLIENT=http.
// quality_prob нет: у заглушки нет вероятности.
@Injectable()
export class MockMlClient implements MlClient {
  async analyze(_input: MlAnalyzeInput): Promise<MlAnalyzeResult> {
    const delayMs = Number(process.env.ML_MOCK_DELAY_MS ?? 300);

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return {
      prediction: {
        quality_class: 0,
        violation_type: '',
        anatomical_region: 'Поясничный отдел позвоночника',
      },
      heatmapPng: null,
    };
  }
}
