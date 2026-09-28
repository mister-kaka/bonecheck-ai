import { Injectable } from '@nestjs/common';
import { MlAnalyzeInput, MlClient, MlPrediction } from './ml.types';

// Фиксированный ответ, пока нет модели. Регион обязателен контрактом и по снимку не определяется.
// quality_prob нет: у заглушки нет вероятности.
@Injectable()
export class MockMlClient implements MlClient {
  async analyze(_input: MlAnalyzeInput): Promise<MlPrediction> {
    const delayMs = Number(process.env.ML_MOCK_DELAY_MS ?? 300);

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return {
      quality_class: 0,
      violation_type: '',
      anatomical_region: 'Поясничный отдел позвоночника',
    };
  }
}
