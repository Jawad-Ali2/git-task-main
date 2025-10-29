import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { json } from 'express';

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

  await app.listen(process.env.PORT ?? 5000);
  console.log(`🚀 Server running on http://localhost:${process.env.PORT ?? 5000}`);
}
bootstrap();
