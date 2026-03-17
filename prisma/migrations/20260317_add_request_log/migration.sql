CREATE TABLE "RequestLog" (
  "id" SERIAL PRIMARY KEY,
  "requestId" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "byEmployeeId" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RequestLog_byEmployeeId_fkey" FOREIGN KEY ("byEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
