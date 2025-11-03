import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { json } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for webhook signature verification
  });
  
  // Enable cookie parsing
  app.use(cookieParser());

  // Custom JSON parsing that preserves raw body for webhooks
  app.use((req, res, next) => {
    if (req.path === '/webhooks/github') {
      // For webhook endpoint, store raw body
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        req['rawBody'] = data;
        try {
          req.body = JSON.parse(data);
        } catch (e) {
          req.body = {};
        }
        next();
      });
    } else {
      // For all other endpoints, use normal JSON parsing
      json()(req, res, next);
    }
  });

  // Enable CORS with credentials
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 📚 Setup Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Git Task API')
    .setDescription('API documentation for Git Task - A repository task tracking system')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('repositories', 'Repository management')
    .addTag('tasks', 'Task scanning and management')
    .addTag('webhooks', 'GitHub webhook handlers')
    .addTag('notifications', 'Real-time notifications')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controllers!
    )
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'Git Task API Docs',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(process.env.PORT ?? 5000);
  console.log(`🚀 Server running on http://localhost:${process.env.PORT ?? 5000}`);
  console.log(`📚 API Documentation: http://localhost:${process.env.PORT ?? 5000}/api-docs`);
}
bootstrap();
