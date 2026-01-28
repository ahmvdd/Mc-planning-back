import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.request.deleteMany();
  await prisma.planningEntry.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.organization.deleteMany();

  const organization = await prisma.organization.create({
    data: {
      name: 'MCPlanning Demo',
      code: 'DEMO01',
    },
  });

  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  const hashedEmployeePassword = await bcrypt.hash('temp-1234', 10);

  const admin = await prisma.employee.create({
    data: {
      name: 'Admin',
      email: 'admin@mcplanning.local',
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

  const employees = await prisma.employee.createMany({
    data: [
      {
        name: 'Alice Martin',
        email: 'alice@mcplanning.local',
        role: 'Superviseur',
        status: 'active',
        password: hashedEmployeePassword,
        organizationId: organization.id,
      },
      {
        name: 'Karim Benali',
        email: 'karim@mcplanning.local',
        role: 'Agent planning',
        status: 'active',
        password: hashedEmployeePassword,
        organizationId: organization.id,
      },
      {
        name: 'Sara Dupont',
        email: 'sara@mcplanning.local',
        role: 'Agent terrain',
        status: 'active',
        password: hashedEmployeePassword,
        organizationId: organization.id,
      },
    ],
  });

  const employeeList = await prisma.employee.findMany({
    orderBy: { id: 'asc' },
  });

  await prisma.planningEntry.createMany({
    data: [
      {
        date: new Date('2026-01-27T08:00:00.000Z'),
        shift: '08:00-16:00',
        note: 'Équipe A',
        employeeId: admin.id,
        organizationId: organization.id,
      },
      {
        date: new Date('2026-01-27T10:00:00.000Z'),
        shift: '10:00-18:00',
        note: 'Équipe B',
        employeeId: employeeList[0]?.id ?? admin.id,
        organizationId: organization.id,
      },
      {
        date: new Date('2026-01-28T12:00:00.000Z'),
        shift: '12:00-20:00',
        note: 'Équipe C',
        employeeId: employeeList[1]?.id ?? admin.id,
        organizationId: organization.id,
      },
    ],
  });

  await prisma.request.createMany({
    data: [
      {
        employeeId: employeeList[0]?.id ?? admin.id,
        type: 'Congé payé',
        status: 'pending',
        message: 'Du 05/02 au 09/02',
        organizationId: organization.id,
      },
      {
        employeeId: employeeList[1]?.id ?? admin.id,
        type: 'Document',
        status: 'pending',
        message: 'Attestation employeur',
        organizationId: organization.id,
      },
    ],
  });

  console.log(`Seed completed (${employees.count + 1} employés).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
