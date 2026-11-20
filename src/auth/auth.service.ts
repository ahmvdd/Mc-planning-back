import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
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
    email = email.trim().toLowerCase();
    const user = await this.prisma.employee.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.status === 'invited') {
      throw new UnauthorizedException(
        'Veuillez accepter votre invitation par email avant de vous connecter',
      );
    }
    if (user.status === 'pending' || user.status === 'requested') {
      throw new UnauthorizedException(
        "Votre demande d'adhésion est en attente de validation par un administrateur",
      );
    }
    if (user.status === 'removed') {
      throw new UnauthorizedException('Ce compte a été désactivé');
    }

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.organizationId,
    );
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
    dto.email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.employee.findUnique({
      where: { email: dto.email },
    });
    if (existing)
      throw new BadRequestException('Un compte avec cet email existe déjà');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    if (dto.role === 'admin') {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();

      // Organization + Employee + ownerId doivent être cohérents entre eux :
      // un crash entre ces écritures laisserait une org sans propriétaire ou
      // un employé orphelin. On les regroupe dans une transaction.
      const { user, organizationCode } = await this.prisma.$transaction(
        async (tx) => {
          const organization = await tx.organization.create({
            data: {
              name: dto.orgName ?? dto.name,
              code,
            },
          });

          const created = await tx.employee.create({
            data: {
              name: dto.name,
              email: dto.email,
              role: dto.role,
              status: dto.status ?? 'active',
              password: hashedPassword,
              organizationId: organization.id,
            },
          });

          await tx.organization.update({
            where: { id: organization.id },
            data: { ownerId: created.id },
          });

          return { user: created, organizationCode: organization.code };
        },
      );

      const tokens = await this.issueTokens(
        user.id,
        user.email,
        user.role,
        user.organizationId,
      );
      await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        organizationCode,
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

    // Auto-inscription via code d'organisation : compte créé en attente,
    // un admin doit valider avant que la personne puisse se connecter.
    const user = await this.prisma.employee.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        status: 'pending',
        password: hashedPassword,
        organizationId: organization.id,
      },
    });

    return {
      pending: true,
      message:
        'Votre demande a été envoyée. Un administrateur doit valider votre compte avant que vous puissiez vous connecter.',
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

  async joinRequest(email: string, orgCode: string) {
    if (!email || !orgCode) {
      throw new BadRequestException('Email et code organisation requis');
    }
    email = email.trim().toLowerCase();

    const organization = await this.prisma.organization.findUnique({
      where: { code: orgCode.toUpperCase().trim() },
    });
    if (!organization) {
      throw new BadRequestException('Organisation introuvable');
    }

    const existing = await this.prisma.employee.findUnique({
      where: { email },
    });
    if (existing) {
      throw new BadRequestException(
        existing.status === 'requested' || existing.status === 'pending'
          ? 'Une demande est déjà en attente pour cet email'
          : 'Un compte avec cet email existe déjà',
      );
    }

    const placeholderName =
      email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .trim() || email;
    const randomPassword = crypto.randomBytes(24).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    await this.prisma.employee.create({
      data: {
        name: placeholderName,
        email,
        role: 'employee',
        status: 'requested',
        password: hashedPassword,
        organizationId: organization.id,
      },
    });

    return {
      success: true,
      message:
        'Votre demande a été envoyée. Un administrateur doit valider votre compte.',
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        email: string;
        role: string;
        orgId: number;
      }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.employee.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Token invalide');
      }

      const tokenOk = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!tokenOk) {
        throw new UnauthorizedException('Token invalide');
      }

      const tokens = await this.issueTokens(
        user.id,
        user.email,
        user.role,
        user.organizationId,
      );
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

  private async issueTokens(
    id: number,
    email: string,
    role: string,
    orgId: number,
  ) {
    const payload = { sub: id, email, role, orgId };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ??
      '7d') as JwtSignOptions['expiresIn'];
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
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
