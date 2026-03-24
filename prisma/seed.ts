import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const firstNames = [
  'Alice', 'Karim', 'Sara', 'Mohamed', 'Julie', 'Thomas', 'Fatima', 'Lucas',
  'Amina', 'Pierre', 'Nadia', 'Youssef', 'Claire', 'Mehdi', 'Sophie', 'Amine',
  'Lucie', 'Omar', 'Emma', 'Sami', 'Léa', 'Rachid', 'Camille', 'Bilal',
  'Manon', 'Tarek', 'Inès', 'Kevin', 'Yasmine', 'Nicolas', 'Dounia', 'Maxime',
  'Rim', 'Antoine', 'Hana', 'Julien', 'Salma', 'Baptiste', 'Mariam', 'Rayan',
];

const lastNames = [
  'Martin', 'Benali', 'Dupont', 'Ait Hamou', 'Bernard', 'Chaoui', 'Leroy',
  'Mansouri', 'Moreau', 'Bouazza', 'Simon', 'Hamdi', 'Laurent', 'Tahir',
  'Michel', 'Brahim', 'Garcia', 'Ouali', 'David', 'Ziani', 'Roux', 'Saidi',
  'Fontaine', 'Khaldi', 'Lefebvre', 'Moumen', 'Chevalier', 'Berber', 'Robin',
  'Meziani', 'Muller', 'Haddad', 'Lecomte', 'Boudiaf', 'Girard', 'Aouadi',
  'Bonnet', 'Djebbar', 'Dupuis', 'Charef',
];

const roles = ['Agent terrain', 'Superviseur', 'Agent planning', 'Technicien', 'Coordinateur', 'Chargé de mission'];

const requestTypes = ['Congé payé', 'Congé sans solde', 'Document', 'Bureau', 'Télétravail', 'Arrêt maladie'];

const requestMessages = [
  'Du 05/02 au 09/02, vacances familiales.',
  'Attestation de travail pour dossier bancaire.',
  'Télétravail demandé pour la semaine prochaine.',
  'Congé pour raisons personnelles du 12/03 au 14/03.',
  'Demande de certificat de salaire.',
  'Absence pour convocation administrative.',
  'Congé maternité à partir du 01/04.',
  'Demande de mutation de bureau.',
  'RTT posé pour le vendredi 28/03.',
  'Arrêt maladie prescrit par médecin, du 10/03 au 15/03.',
  'Permission exceptionnelle pour événement familial.',
  'Demande de relevé de congés restants.',
  'Congé sans solde pour formation personnelle.',
  "Demande d'accès au bureau annexe.",
  "Justificatif d'absence pour rendez-vous médical.",
];

const requestStatuses = ['pending', 'pending', 'pending', 'approved', 'rejected'];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEmail(name: string, index: number): string {
  const clean = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
  return `${clean}.${index}@shiftly-test.local`;
}

async function main() {
  console.log('Nettoyage des données existantes...');
  await prisma.requestLog.deleteMany();
  await prisma.request.deleteMany();
  await prisma.planningEntry.deleteMany();
  await prisma.planning.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.organization.deleteMany();

  console.log('Création de l\'organisation...');
  const organization = await prisma.organization.create({
    data: {
      name: 'Shiftly Demo Corp',
      code: 'DEMO2024',
    },
  });

  console.log('Création du compte admin...');
  const hashedAdminPassword = await bcrypt.hash('testtest', 10);
  const admin = await prisma.employee.create({
    data: {
      name: 'Admin Test',
      email: 'test@example.hetic',
      role: 'admin',
      status: 'active',
      password: hashedAdminPassword,
      organizationId: organization.id,
    },
  });

  await prisma.organization.update({
    where: { id: organization.id },
    data: { ownerId: admin.id },
  });

  console.log('Création de 200 employés...');
  const hashedEmployeePassword = await bcrypt.hash('employee123', 10);
  const employeeData = Array.from({ length: 200 }, (_, i) => {
    const firstName = getRandom(firstNames);
    const lastName = getRandom(lastNames);
    const fullName = `${firstName} ${lastName}`;
    return {
      name: fullName,
      email: generateEmail(fullName, i + 1),
      role: getRandom(roles),
      status: Math.random() > 0.1 ? 'active' : 'inactive',
      password: hashedEmployeePassword,
      organizationId: organization.id,
    };
  });

  await prisma.employee.createMany({ data: employeeData });

  const allEmployees = await prisma.employee.findMany({
    where: { organizationId: organization.id, role: { not: 'admin' } },
    select: { id: true },
  });

  console.log('Création de 60 demandes RH...');
  const requestsData = Array.from({ length: 60 }, () => ({
    employeeId: getRandom(allEmployees).id,
    type: getRandom(requestTypes),
    status: getRandom(requestStatuses),
    message: getRandom(requestMessages),
    organizationId: organization.id,
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
  }));

  await prisma.request.createMany({ data: requestsData });

  console.log('Création d\'un planning exemple...');
  const planning = await prisma.planning.create({
    data: {
      name: 'Planning semaine 13',
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      organizationId: organization.id,
    },
  });

  const shifts = ['08:00-16:00', '10:00-18:00', '12:00-20:00', '06:00-14:00', '14:00-22:00'];
  const planningEntries = allEmployees.slice(0, 40).map((emp, i) => ({
    date: new Date(`2026-03-${23 + (i % 7)}`),
    shift: getRandom(shifts),
    employeeId: emp.id,
    organizationId: organization.id,
    planningId: planning.id,
  }));

  await prisma.planningEntry.createMany({ data: planningEntries });

  const totalRequests = await prisma.request.count({ where: { organizationId: organization.id } });
  const pendingRequests = await prisma.request.count({ where: { organizationId: organization.id, status: 'pending' } });
  const totalEmployees = await prisma.employee.count({ where: { organizationId: organization.id } });

  console.log('\n✅ Seed terminé avec succès !');
  console.log('─────────────────────────────────');
  console.log(`  Organisation : ${organization.name} (code: ${organization.code})`);
  console.log(`  Employés     : ${totalEmployees} (dont 1 admin)`);
  console.log(`  Demandes     : ${totalRequests} total (${pendingRequests} en attente)`);
  console.log(`  Planning     : ${planningEntries.length} créneaux`);
  console.log('─────────────────────────────────');
  console.log('  Login admin  : test@example.hetic');
  console.log('  Mot de passe : testtest');
  console.log('─────────────────────────────────\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
