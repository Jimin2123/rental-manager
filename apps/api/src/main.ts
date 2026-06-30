import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SwaggerModule } from '@nestjs/swagger';
import swaggerConfig from './configs/swagger.config';
import { ValidationPipe } from '@nestjs/common';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';
import { PaginationInterceptor } from './common/interceptors/pagination.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, documentFactory());

  // DB 트리거/제약 위반을 500 대신 400/409/404로 변환 (HttpException은 통과)
  app.useGlobalFilters(new DatabaseExceptionFilter());

  // { data, total } 반환을 X-Total-Count 헤더 + data 배열로 변환 (목록 페이지네이션)
  app.useGlobalInterceptors(new PaginationInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['X-Total-Count'],
  });

  app.use(helmet());
  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);

  process.on('SIGTERM', () => void app.close());
}
void bootstrap();
