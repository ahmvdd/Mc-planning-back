import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

const mockPrismaService = {
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return status ok', () => {
      expect(appController.getStatus()).toEqual({ status: 'ok', service: 'mcplanning-manager' });
    });
  });

  describe('health', () => {
    it('should return db connected when query succeeds', async () => {
      const result = await appController.getHealth();
      expect(result).toEqual({ status: 'ok', db: 'connected' });
    });

    it('should return db unreachable when query fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
      const result = await appController.getHealth();
      expect(result).toEqual({ status: 'degraded', db: 'unreachable' });
    });
  });
});
