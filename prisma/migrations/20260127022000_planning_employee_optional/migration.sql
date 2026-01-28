-- Make planning entries optionally global
ALTER TABLE "PlanningEntry" ALTER COLUMN "employeeId" DROP NOT NULL;
