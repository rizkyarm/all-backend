import { NestFactory, Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ResponseTransformerInterceptor } from './common/interceptors';
import { HttpExceptionFilter } from './common/filters';
import { Logger } from 'nestjs-pino';

import { SnakeToCamelValidationPipe } from './common/pipes/snake-to-camel-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api/v1');

  // Security: Helmet sets various HTTP headers to help protect the app
  // Configure cross-origin policies to allow frontend requests
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );

  // Security: Enable CORS with proper settings
  // Note: credentials:true requires a specific origin, NOT '*'
  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl ? frontendUrl.split(',').map((u) => u.trim()) : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: !!frontendUrl, // Only enable credentials when a specific origin is set
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new SnakeToCamelValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(
    new ResponseTransformerInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Setup Swagger (disabled in production to hide internal API structure)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('API Documentation')
      .setDescription('The API description for our application')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
