-- 마일스톤 간격 설정 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

-- milestoneColumnWidths 컬럼 추가 (JSON 타입, nullable)
ALTER TABLE "Quotation" 
ADD COLUMN IF NOT EXISTS "milestoneColumnWidths" JSONB;

-- rowsPerPage 컬럼 추가 (INTEGER 타입, nullable, 기본값 20)
ALTER TABLE "Quotation" 
ADD COLUMN IF NOT EXISTS "rowsPerPage" INTEGER DEFAULT 20;

-- 기존 데이터에 기본값 설정 (선택사항)
UPDATE "Quotation" 
SET "rowsPerPage" = 20 
WHERE "rowsPerPage" IS NULL;

-- roundingUnit 컬럼 추가 (INTEGER 타입, nullable, 기본값 10000)
ALTER TABLE "Quotation" 
ADD COLUMN IF NOT EXISTS "roundingUnit" INTEGER DEFAULT 10000;

-- 기존 데이터에 기본값 설정 (선택사항)
UPDATE "Quotation" 
SET "roundingUnit" = 10000 
WHERE "roundingUnit" IS NULL;

