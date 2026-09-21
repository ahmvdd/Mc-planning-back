import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  private get resend() {
    return new Resend(process.env.RESEND_API_KEY ?? 'no-key');
  }

  async sendWelcomeEmail(email: string) {
    try {
      await this.resend.emails.send({
        from: process.env.RESEND_FROM ?? 'Shiftly <onboarding@resend.dev>',
        to: [email],
        subject: 'Bienvenue sur Shiftly',
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
            <div style="background: linear-gradient(135deg, #4f46e5, #0ea5e9); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 32px;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800;">Shiftly</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Gestion de planning d'équipe</p>
            </div>

            <h2 style="color: #0f172a; font-size: 22px;">Bienvenue !</h2>
            <p style="color: #475569; line-height: 1.6;">
              Merci de votre intérêt pour Shiftly. Créez votre compte gratuit pour publier votre premier planning en quelques minutes, sans tableur.
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="https://shiftly.site/signup?email=${encodeURIComponent(email)}" style="background: #4f46e5; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; display: inline-block;">
                Créer mon compte →
              </a>
            </div>

            <p style="color: #94a3b8; font-size: 13px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              Vous recevez cet email car vous avez laissé votre adresse sur shiftly.site.<br/>
              Si ce n'était pas vous, ignorez simplement ce message.
            </p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.warn(`Échec envoi email de bienvenue à ${email}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
