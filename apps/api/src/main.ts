import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SwaggerModule } from '@nestjs/swagger';
import swaggerConfig from './configs/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, documentFactory());

  app.use(helmet());
  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
