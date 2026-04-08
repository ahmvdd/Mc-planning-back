CREATE TABLE "Pointage" (
  "id" SERIAL PRIMARY KEY,
  "employeeId" INTEGER NOT NULL,
  "planningEntryId" INTEGER,
  "organizationId" INTEGER NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL,
  "note" TEXT,
  CONSTRAINT "Pointage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Pointage_planningEntryId_fkey" FOREIGN KEY ("planningEntryId") REFERENCES "PlanningEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Pointage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
