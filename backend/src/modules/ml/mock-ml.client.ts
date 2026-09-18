import { Injectable } from '@nestjs/common';
import { MlAnalyzeInput, MlClient, MlPrediction } from './ml.types';

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
      quality_prob: 0.05,
      anatomical_region: 'Поясничный отдел позвоночника',
    };
  }
}
