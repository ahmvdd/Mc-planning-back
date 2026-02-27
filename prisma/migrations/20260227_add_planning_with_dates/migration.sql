-- CreateTable
CREATE TABLE "Planning" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Planning_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PlanningEntry" ADD COLUMN "planningId" INTEGER;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningEntry" ADD CONSTRAINT "PlanningEntry_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
