-- AlterTable
ALTER TABLE "diagnosis_drafts" ADD COLUMN     "invitation_opened" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invitation_token" TEXT,
ADD COLUMN     "response_id" INTEGER;

-- AlterTable
ALTER TABLE "responses" ADD COLUMN     "updated_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_drafts_response_id_key" ON "diagnosis_drafts"("response_id");

-- AddForeignKey
ALTER TABLE "diagnosis_drafts" ADD CONSTRAINT "diagnosis_drafts_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

