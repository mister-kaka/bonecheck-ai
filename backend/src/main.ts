import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RUEN API')
    .setDescription('API-каркас сервиса оценки качества DXA/DICOM-исследований')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 3000);
  await app.listen(port, process.env.BACKEND_HOST ?? '0.0.0.0');
}

void bootstrap();
