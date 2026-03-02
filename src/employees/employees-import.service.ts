import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { InvitationService } from '../invitation/invitation.service';

export type ImportResult = {
  total: number;
  invited: number;
  errors: { email: string; reason: string }[];
};

@Injectable()
export class EmployeesImportService {
  constructor(private readonly invitationService: InvitationService) {}

  async importFromBuffer(
    buffer: Buffer,
    mimetype: string,
    orgId: number,
  ): Promise<ImportResult> {
    const rows = this.parseFile(buffer, mimetype);
    const result: ImportResult = { total: rows.length, invited: 0, errors: [] };

    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        result.errors.push({ email: email ?? '(vide)', reason: 'Email invalide' });
        continue;
      }
      try {
        await this.invitationService.sendInvitation(email, orgId);
        result.invited++;
      } catch (err: any) {
        result.errors.push({ email, reason: err?.message ?? 'Erreur inconnue' });
      }
    }

    return result;
  }

  private parseFile(buffer: Buffer, mimetype: string): { email: string; name?: string }[] {
    // CSV
    if (mimetype === 'text/csv' || mimetype === 'application/csv') {
      const records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
      return records.map(r => ({ email: r.email ?? r.Email ?? r.EMAIL, name: r.name ?? r.Name }));
    }

    // Excel (.xlsx / .xls)
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    return rows.map(r => ({
      email: String(r.email ?? r.Email ?? r.EMAIL ?? ''),
      name: String(r.name ?? r.Name ?? ''),
    }));
  }
}
