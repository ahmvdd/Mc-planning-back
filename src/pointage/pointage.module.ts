import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PointageController } from './pointage.controller';
import { PointageService } from './pointage.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '2h' },
    }),
  ],
  controllers: [PointageController],
  providers: [PointageService],
})
export class PointageModule {}
