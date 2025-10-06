import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure CORS for multiple environments
  const allowedOrigins = [
    'http://localhost:3000', // Local development
    'http://localhost:3001', // Local development alternative
    process.env.FRONTEND_URL, // Environment-specific frontend URL
    process.env.PRODUCTION_FRONTEND_URL, // Production frontend URL
  ].filter(Boolean); // Remove undefined values

  console.log('Allowed CORS origins:', allowedOrigins);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        console.log(`CORS allowed for origin: ${origin}`);
        return callback(null, true);
      }

      const msg =
        'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

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

  await app.listen(process.env.PORT ?? 3001);
  console.log(
    `Authentication API running on: http://localhost:${process.env.PORT ?? 3001}`,
  );
}
bootstrap();
