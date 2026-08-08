import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(require('express').json({ limit: '10mb' }));
  const prodOrigins = ["https://mc-planning-front.vercel.app", "https://www.shiftly.site", "https://shiftly.site"];
  app.enableCors({
    origin: process.env.FRONTEND_URL ? [...prodOrigins, process.env.FRONTEND_URL] : prodOrigins,
    credentials: true,
  });
  app.setGlobalPrefix("api");
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
