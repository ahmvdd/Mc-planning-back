-- CreateTable
CREATE TABLE "PlanningTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningTemplateEntry" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "shift" TEXT NOT NULL,
    "note" TEXT,
    "employeeId" INTEGER,

    CONSTRAINT "PlanningTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanningTemplate" ADD CONSTRAINT "PlanningTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTemplateEntry" ADD CONSTRAINT "PlanningTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PlanningTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTemplateEntry" ADD CONSTRAINT "PlanningTemplateEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
