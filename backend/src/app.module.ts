import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { StudiesModule } from './modules/studies/studies.module';
import { ProfileModule } from './modules/profile/profile.module';

@Module({
  imports: [HealthModule, StudiesModule, ProfileModule],
})
export class AppModule {}
