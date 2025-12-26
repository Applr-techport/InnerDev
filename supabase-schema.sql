-- 견적서 테이블 생성
CREATE TABLE IF NOT EXISTS "Quotation" (
  "id" TEXT PRIMARY KEY,
  "version" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyName" TEXT NOT NULL,
  "companyAddress" TEXT NOT NULL,
  "companyBusinessNumber" TEXT NOT NULL,
  "companyRepresentative" TEXT NOT NULL,
  "companyPhone" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "clientPhone" TEXT NOT NULL,
  "projectName" TEXT NOT NULL,
  "projectVersion" TEXT NOT NULL,
  "projectDate" TEXT NOT NULL,
  "projectValidityDays" INTEGER NOT NULL DEFAULT 14,
  "discountRate" DOUBLE PRECISION NOT NULL,
  "workPeriod" TEXT NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
  "historyData" JSONB NOT NULL,
  "milestonesData" JSONB NOT NULL,
  "quotationItems" JSONB NOT NULL,
  "gradeInfoData" JSONB NOT NULL,
  "notes" TEXT
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS "Quotation_projectName_idx" ON "Quotation"("projectName");
CREATE INDEX IF NOT EXISTS "Quotation_createdAt_idx" ON "Quotation"("createdAt");
