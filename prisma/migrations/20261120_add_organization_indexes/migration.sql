-- CreateIndex
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");

-- CreateIndex
CREATE INDEX "Availability_organizationId_idx" ON "Availability"("organizationId");

-- CreateIndex
CREATE INDEX "Planning_organizationId_idx" ON "Planning"("organizationId");

-- CreateIndex
CREATE INDEX "PlanningEntry_organizationId_idx" ON "PlanningEntry"("organizationId");

-- CreateIndex
CREATE INDEX "PlanningEntry_organizationId_date_idx" ON "PlanningEntry"("organizationId", "date");

-- CreateIndex
CREATE INDEX "PlanningTemplate_organizationId_idx" ON "PlanningTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "Request_organizationId_idx" ON "Request"("organizationId");

-- CreateIndex
CREATE INDEX "Pointage_organizationId_idx" ON "Pointage"("organizationId");

