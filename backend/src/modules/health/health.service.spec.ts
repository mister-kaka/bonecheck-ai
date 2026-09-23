/// <reference types="jest" />
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('возвращает статус «ok»', () => {
    const service = new HealthService();
    expect(service.getStatus()).toEqual({ status: 'ok' });
  });
});
