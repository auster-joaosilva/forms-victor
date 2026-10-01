-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('admin', 'manager', 'regularization', 'operator');
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'operator';


-- `team` desce para `operator`, o mais fechado, e NÃO para `manager`, decisão do Victor (origin/main 10f5a4c):
-- rebaixar por engano se conserta em dois cliques; manter alcance por engano não aparece em lugar nenhum.
UPDATE "users" SET "role" = 'operator' WHERE "role" NOT IN ('admin', 'manager', 'regularization', 'operator');
