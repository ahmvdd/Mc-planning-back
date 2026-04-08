import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';

const QR_SECRET = process.env.JWT_SECRET + '_qr';
const QR_VALIDITY_HOURS = 8;
const LATE_THRESHOLD_MINUTES = 15;
const WORKPLACE_QR_SECRET = process.env.JWT_SECRET + '_workplace';

@Injectable()
export class PointageService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ── Génère un QR code pour un créneau planning ──
  async generateQR(planningEntryId: number, orgId: number): Promise<string> {
    const entry = await this.prisma.planningEntry.findFirst({
      where: { id: planningEntryId, organizationId: orgId },
    });
    if (!entry) throw new NotFoundException('Créneau introuvable');

    const token = this.jwtService.sign(
      { planningEntryId, orgId, type: 'qr_pointage' },
      { secret: QR_SECRET, expiresIn: `${QR_VALIDITY_HOURS}h` },
    );

    const url = `${process.env.FRONTEND_URL}/scan?token=${token}`;
    const img = await QRCode.toDataURL(url);
    return { img };
  }

  // ── L'employé scanne → enregistre le pointage ──
  async scan(token: string, employeeId: number, orgId: number) {
    let payload: { planningEntryId: number; orgId: number; type: string };

    try {
      payload = this.jwtService.verify(token, { secret: QR_SECRET });
    } catch {
      throw new BadRequestException('QR code invalide ou expiré');
    }

    if (payload.type !== 'qr_pointage') throw new BadRequestException('QR invalide');
    if (payload.orgId !== orgId) throw new BadRequestException('Organisation incorrecte');

    const entry = await this.prisma.planningEntry.findFirst({
      where: { id: payload.planningEntryId, organizationId: orgId },
    });
    if (!entry) throw new NotFoundException('Créneau introuvable');

    // Vérifier si déjà pointé aujourd'hui pour ce créneau
    const existing = await this.prisma.pointage.findFirst({
      where: {
        employeeId,
        planningEntryId: entry.id,
      },
    });
    if (existing) throw new BadRequestException('Vous avez déjà pointé pour ce créneau');

    // Calcul du statut
    const now = new Date();
    const shiftDate = new Date(entry.date);
    const diffMinutes = (now.getTime() - shiftDate.getTime()) / 60000;

    let status: string;
    if (diffMinutes < -LATE_THRESHOLD_MINUTES) {
      status = 'present'; // En avance ou à l'heure
    } else if (diffMinutes <= LATE_THRESHOLD_MINUTES) {
      status = 'present';
    } else if (diffMinutes <= 60) {
      status = 'late';
    } else {
      status = 'absent';
    }

    return this.prisma.pointage.create({
      data: {
        employeeId,
        planningEntryId: entry.id,
        organizationId: orgId,
        scannedAt: now,
        status,
      },
      include: { employee: { select: { name: true } } },
    });
  }

  // ── Admin : génère le QR code de l'entrée (workplace) ──
  async generateWorkplaceQR(orgId: number): Promise<string> {
    const token = this.jwtService.sign(
      { orgId, type: 'workplace_checkin' },
      { secret: WORKPLACE_QR_SECRET }, // pas d'expiration → QR permanent
    );
    const url = `${process.env.FRONTEND_URL}/scan?workplace=${token}`;
    const img = await QRCode.toDataURL(url);
    return { img };
  }

  // ── Employé : scanne le QR d'entrée → détecte son shift auto ──
  async checkin(employeeId: number, orgId: number, workplaceToken: string) {
    try {
      const payload = this.jwtService.verify<{ orgId: number; type: string }>(
        workplaceToken,
        { secret: WORKPLACE_QR_SECRET },
      );
      if (payload.type !== 'workplace_checkin') throw new Error();
      if (payload.orgId !== orgId) throw new BadRequestException('Organisation incorrecte');
    } catch {
      throw new BadRequestException('QR code invalide');
    }

    // Trouver le shift de l'employé aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entry = await this.prisma.planningEntry.findFirst({
      where: {
        organizationId: orgId,
        employeeId,
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { date: 'asc' },
    });

    if (!entry) throw new NotFoundException('Aucun créneau prévu pour vous aujourd\'hui');

    // Vérifier si déjà pointé
    const existing = await this.prisma.pointage.findFirst({
      where: { employeeId, planningEntryId: entry.id },
    });
    if (existing) throw new BadRequestException('Vous avez déjà pointé pour ce créneau');

    // Calcul du statut
    const now = new Date();
    const shiftDate = new Date(entry.date);
    const diffMinutes = (now.getTime() - shiftDate.getTime()) / 60000;

    let status: string;
    if (diffMinutes <= LATE_THRESHOLD_MINUTES) {
      status = 'present';
    } else if (diffMinutes <= 60) {
      status = 'late';
    } else {
      status = 'absent';
    }

    return this.prisma.pointage.create({
      data: {
        employeeId,
        planningEntryId: entry.id,
        organizationId: orgId,
        scannedAt: now,
        status,
      },
      include: { employee: { select: { name: true } } },
    });
  }

  // ── Admin : pointages du jour ──
  async getToday(orgId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Tous les créneaux du jour
    const entries = await this.prisma.planningEntry.findMany({
      where: {
        organizationId: orgId,
        date: { gte: today, lt: tomorrow },
      },
      include: {
        employee: { select: { id: true, name: true } },
        pointages: {
          include: { employee: { select: { name: true } } },
        },
      },
    });

    return entries.map(entry => ({
      id: entry.id,
      shift: entry.shift,
      date: entry.date,
      employee: entry.employee,
      pointage: entry.pointages[0] ?? null,
      status: entry.pointages[0]?.status ?? 'non_pointe',
    }));
  }

  // ── Admin : pointage manuel ──
  async manualPointage(planningEntryId: number, employeeId: number, orgId: number, status: string, note?: string) {
    const entry = await this.prisma.planningEntry.findFirst({
      where: { id: planningEntryId, organizationId: orgId },
    });
    if (!entry) throw new NotFoundException('Créneau introuvable');

    return this.prisma.pointage.upsert({
      where: {
        // Upsert sur employeeId + planningEntryId (on va ajouter un unique)
        id: (await this.prisma.pointage.findFirst({ where: { employeeId, planningEntryId } }))?.id ?? 0,
      },
      create: {
        employeeId,
        planningEntryId,
        organizationId: orgId,
        status,
        note,
      },
      update: { status, note },
    });
  }
}
