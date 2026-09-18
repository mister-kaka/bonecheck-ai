import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { StudiesModule } from './modules/studies/studies.module';

@Module({
  imports: [HealthModule, StudiesModule],
})
export class AppModule {}
