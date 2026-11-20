import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';

const QR_SECRET = process.env.JWT_SECRET + '_qr';
const QR_VALIDITY_HOURS = 8;
const LATE_THRESHOLD_MINUTES = 15;
const WORKPLACE_QR_SECRET = process.env.JWT_SECRET + '_workplace';
const BUSINESS_TIMEZONE = 'Europe/Paris';

// Bornes du jour calendaire courant côté Europe/Paris (et non celui du
// serveur, qui tourne en UTC sur Render — sans ça un check-in à 00h30
// heure de Paris en hiver cherchait le créneau de la veille).
function businessDayRange(): { start: Date; end: Date } {
  const start = DateTime.now().setZone(BUSINESS_TIMEZONE).startOf('day');
  return { start: start.toJSDate(), end: start.plus({ days: 1 }).toJSDate() };
}

// Extrait l'heure de début depuis le champ shift (pensée comme heure locale
// Europe/Paris, celle que les managers saisissent) et la combine avec la
// date du créneau. Gère : "08h-16h", "08h00-16h00", "08:00 - 16:00",
// "Matin 8h-16h", "8h30 – 16h", etc.
function parseShiftStart(shift: string, entryDate: Date): Date {
  const utcDay = DateTime.fromJSDate(entryDate, { zone: 'utc' });
  const m = shift.match(/(\d{1,2})[h:](\d{0,2})/i);
  const hour = m ? parseInt(m[1], 10) : 0;
  const minute = m ? parseInt(m[2] || '0', 10) : 0;
  return DateTime.fromObject(
    { year: utcDay.year, month: utcDay.month, day: utcDay.day, hour, minute },
    { zone: BUSINESS_TIMEZONE },
  ).toJSDate();
}

@Injectable()
export class PointageService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ── Génère un QR code pour un créneau planning ──
  async generateQR(planningEntryId: number, orgId: number): Promise<{ img: string }> {
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

    // Calcul du statut basé sur l'heure réelle du shift
    const now = new Date();
    const shiftDate = parseShiftStart(entry.shift, entry.date);
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
  async generateWorkplaceQR(orgId: number): Promise<{ img: string }> {
    const token = this.jwtService.sign(
      { orgId, type: 'workplace_checkin' },
      { secret: WORKPLACE_QR_SECRET, expiresIn: '3650d' }, // QR permanent — le module JWT a un défaut de 2h qu'il faut écraser explicitement
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
    const { start: today, end: tomorrow } = businessDayRange();

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

    // Calcul du statut basé sur l'heure réelle du shift
    const now = new Date();
    const shiftDate = parseShiftStart(entry.shift, entry.date);
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
    const { start: today, end: tomorrow } = businessDayRange();

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
