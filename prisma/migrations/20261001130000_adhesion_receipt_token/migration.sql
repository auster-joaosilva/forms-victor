-- AlterTable
ALTER TABLE "adhesions" ADD COLUMN     "receipt_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "adhesions_receipt_token_key" ON "adhesions"("receipt_token");
