-- =====================================================================
--  ARTIFAX — update for the warehouse + email-code changes (3 Nov 2026)
--  Run this ONCE in Supabase → SQL Editor if you already ran setup.sql
--  before today. (If you re-run the new setup.sql instead, skip this.)
-- =====================================================================

-- Orders remember which warehouse the materials came from
ALTER TABLE "Orders"
    ADD COLUMN IF NOT EXISTS "SourceBranchID" integer REFERENCES "Branches"("BranchID") ON DELETE SET NULL;
UPDATE "Orders" SET "SourceBranchID" = "BranchID" WHERE "SourceBranchID" IS NULL;

-- Clearer warehouse names (rename freely)
UPDATE "Branches" SET "BranchName" = 'Warehouse 1 · Johannesburg' WHERE "BranchID" = 1;
UPDATE "Branches" SET "BranchName" = 'Warehouse 2 · Cape Town'    WHERE "BranchID" = 2;

-- A Cape Town employee, so you can show that each user only sees their own warehouse
INSERT INTO "Employees" ("EmployeeEmail", "EmployeeName", "EmployeePasswordHash", "BranchId", "EmployeeLevel")
SELECT 'cpt@artifax.app', 'Thandi (Cape Town)', extensions.crypt('ArtifaxDemo2026!', extensions.gen_salt('bf', 11)), 2, 'Employee'
WHERE NOT EXISTS (SELECT 1 FROM "Employees" WHERE "EmployeeEmail" = 'cpt@artifax.app');

-- Put YOUR real email on the admin account so the 6-digit login code reaches you.
-- (Edit the address, then run.)
UPDATE "Employees" SET "EmployeeEmail" = 'andre.jjvanheerden@gmail.com' WHERE "EmployeeEmail" = 'admin@artifax.app';

SELECT "EmployeeId", "EmployeeEmail", "EmployeeName", "BranchId", "EmployeeLevel" FROM "Employees" ORDER BY "EmployeeId";
