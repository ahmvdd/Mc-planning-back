import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvitationService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  constructor(private readonly prisma: PrismaService) {}

  async sendInvitation(email: string, orgId: number) {
    // Vérifie si un compte existe déjà
    const existing = await this.prisma.employee.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Un compte existe déjà pour cet email');

    // Génère un token unique valide 48h
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Récupère le nom de l'organisation
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    // Supprime les invitations précédentes non utilisées pour ce mail dans cette org
    await this.prisma.invitation.deleteMany({
      where: { email, organizationId: orgId, usedAt: null },
    });

    // Crée l'invitation en DB
    await this.prisma.invitation.create({
      data: { email, token, organizationId: orgId, expiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/invitation/${token}`;

    // Envoie l'email
    await this.resend.emails.send({
      from: process.env.RESEND_FROM ?? 'MCPlanning <onboarding@resend.dev>',
      to: [email],
      subject: `Invitation à rejoindre ${org?.name ?? 'MCPlanning'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <div style="background: linear-gradient(135deg, #4f46e5, #0ea5e9); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 32px;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800;">MCPlanning</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Gestion de planning d'équipe</p>
          </div>

          <h2 style="color: #0f172a; font-size: 22px;">Vous avez été invité(e) !</h2>
          <p style="color: #475569; line-height: 1.6;">
            <strong>${org?.name ?? 'Votre responsable'}</strong> vous invite à rejoindre l'espace de gestion de planning MCPlanning.
          </p>
          <p style="color: #475569; line-height: 1.6;">
            Cliquez sur le bouton ci-dessous pour créer votre compte. Ce lien est valable <strong>48 heures</strong>.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteUrl}" style="background: #4f46e5; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; display: inline-block;">
              Créer mon compte →
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 13px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Si vous ne vous attendiez pas à cette invitation, ignorez cet email.<br/>
            Lien : ${inviteUrl}
          </p>
        </div>
      `,
    });

    return { success: true, email };
  }

  async validateToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { name: true, code: true } } },
    });

    if (!invitation) throw new BadRequestException('Invitation introuvable');
    if (invitation.usedAt) throw new BadRequestException('Cette invitation a déjà été utilisée');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation expirée');

    return {
      email: invitation.email,
      organizationName: invitation.organization.name,
      valid: true,
    };
  }

  async acceptInvitation(token: string, name: string, password: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) throw new BadRequestException('Invitation introuvable');
    if (invitation.usedAt) throw new BadRequestException('Invitation déjà utilisée');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation expirée');

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await this.prisma.employee.create({
      data: {
        name,
        email: invitation.email,
        password: hashedPassword,
        role: 'employee',
        status: 'active',
        organizationId: invitation.organizationId,
      },
    });

    // Marque l'invitation comme utilisée
    await this.prisma.invitation.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    return { success: true, employeeId: employee.id };
  }
}
