import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.employee.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.organizationId);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
      },
    };
  }

  async signup(dto: SignupDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    if (dto.role === 'admin') {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const organization = await this.prisma.organization.create({
        data: {
          name: dto.orgName ?? dto.name,
          code,
        },
      });

      const user = await this.prisma.employee.create({
        data: {
          name: dto.name,
          email: dto.email,
          role: dto.role,
          status: dto.status ?? 'active',
          password: hashedPassword,
          organizationId: organization.id,
        },
      });

      await this.prisma.organization.update({
        where: { id: organization.id },
        data: { ownerId: user.id },
      });

      const tokens = await this.issueTokens(user.id, user.email, user.role, user.organizationId);
      await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        organizationCode: organization.code,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          organizationId: user.organizationId,
        },
      };
    }

    if (!dto.orgCode) {
      throw new BadRequestException('Code organisation requis');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { code: dto.orgCode },
    });
    if (!organization) {
      throw new BadRequestException('Organisation introuvable');
    }

    const user = await this.prisma.employee.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        status: dto.status ?? 'active',
        password: hashedPassword,
        organizationId: organization.id,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.organizationId);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number; email: string; role: string; orgId: number }>(
        refreshToken,
        {
          secret: process.env.JWT_REFRESH_SECRET || 'mcplanning-refresh-secret',
        },
      );

      const user = await this.prisma.employee.findUnique({ where: { id: payload.sub } });
      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Token invalide');
      }

      const tokenOk = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!tokenOk) {
        throw new UnauthorizedException('Token invalide');
      }

      const tokens = await this.issueTokens(user.id, user.email, user.role, user.organizationId);
      await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          organizationId: user.organizationId,
        },
      };
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }

  async logout(userId: number) {
    await this.prisma.employee.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return { success: true };
  }

  private async issueTokens(id: number, email: string, role: string, orgId: number) {
    const payload = { sub: id, email, role, orgId };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as JwtSignOptions['expiresIn'];
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'mcplanning-refresh-secret',
      expiresIn: refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  private async storeRefreshTokenHash(userId: number, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.employee.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }
}
