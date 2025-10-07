import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for production frontend
  app.enableCors({
    origin: ['https://api.aestheticmatch.site'],
    credentials: true,
  });

  // Trust proxy headers from ALB
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(3001, '0.0.0.0'); // Listen on all interfaces for ECS/ALB health checks
  console.log('Authentication API running on: http://0.0.0.0:3001/api');
}
bootstrap();
