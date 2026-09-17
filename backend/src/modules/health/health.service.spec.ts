import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns ok status', () => {
    const service = new HealthService();
    expect(service.getStatus()).toEqual({ status: 'ok' });
  });
});
