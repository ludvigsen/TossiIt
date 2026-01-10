/*
  Warnings:

  - You are about to drop the column `expires_at` on the `actionable_items` table. All the data in the column will be lost.
  - You are about to drop the column `kind` on the `actionable_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "actionable_items" DROP COLUMN "expires_at",
DROP COLUMN "kind";

-- AlterTable
ALTER TABLE "raw_dumps" ADD COLUMN     "category" TEXT,
ADD COLUMN     "info_context" JSONB;
