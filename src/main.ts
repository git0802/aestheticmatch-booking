import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix
  app.setGlobalPrefix('api');

  // Enable CORS for development and production
  const corsOrigins =
    process.env.NODE_ENV === 'production'
      ? ['https://api.aestheticmatch.site', 'https://aestheticmatch.site']
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0'); // Listen on all interfaces for ECS/ALB health checks
  console.log(`Authentication API running on: http://0.0.0.0:${port}/api`);
}
bootstrap();
