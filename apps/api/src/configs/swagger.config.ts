import { DocumentBuilder } from '@nestjs/swagger';

import { version as apiVersion } from '../../package.json';

const swaggerConfig = new DocumentBuilder()
  .setTitle('API Documentation') // 문서 제목
  .setDescription(
    'This is the API documentation for the project. It provides details about the available endpoints and how to use them.',
  ) // 자세한 설명
  .setVersion(apiVersion) // API 버전
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter JWT token for authorization', // 추가적인 설명 제공
    },
    'JWT', // 보안 스키마 이름을 의미 있는 값으로 변경
  )
  .addTag('Authentication', 'Endpoints related to user authentication') // 태그 추가 및 설명 제공
  .addTag('Users', 'Endpoints for user management') // 사용자 관리 태그 추가
  .addServer('http://localhost:3000', 'Local server') // 로컬 서버 추가
  .addServer('https://api.production.com', 'Production server') // 프로덕션 서버 추가
  .build();

export default swaggerConfig;
