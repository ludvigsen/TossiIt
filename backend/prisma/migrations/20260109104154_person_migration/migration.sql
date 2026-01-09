/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "raw_dumps" DROP CONSTRAINT "raw_dumps_user_id_fkey";

-- DropForeignKey
ALTER TABLE "smart_inbox" DROP CONSTRAINT "smart_inbox_user_id_fkey";

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "raw_dumps" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "smart_inbox" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "category" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "is_important" BOOLEAN NOT NULL DEFAULT false,
    "pinned_order" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actionable_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "dump_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'todo',
    "due_date" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT,
    "category" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "archived_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "actionable_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EventPeople" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_EventPeople_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DumpPeople" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_DumpPeople_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InboxPeople" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_InboxPeople_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ActionItemPeople" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ActionItemPeople_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "people_user_id_name_key" ON "people"("user_id", "name");

-- CreateIndex
CREATE INDEX "_EventPeople_B_index" ON "_EventPeople"("B");

-- CreateIndex
CREATE INDEX "_DumpPeople_B_index" ON "_DumpPeople"("B");

-- CreateIndex
CREATE INDEX "_InboxPeople_B_index" ON "_InboxPeople"("B");

-- CreateIndex
CREATE INDEX "_ActionItemPeople_B_index" ON "_ActionItemPeople"("B");

-- AddForeignKey
ALTER TABLE "raw_dumps" ADD CONSTRAINT "raw_dumps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_inbox" ADD CONSTRAINT "smart_inbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actionable_items" ADD CONSTRAINT "actionable_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actionable_items" ADD CONSTRAINT "actionable_items_dump_id_fkey" FOREIGN KEY ("dump_id") REFERENCES "raw_dumps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventPeople" ADD CONSTRAINT "_EventPeople_A_fkey" FOREIGN KEY ("A") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventPeople" ADD CONSTRAINT "_EventPeople_B_fkey" FOREIGN KEY ("B") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DumpPeople" ADD CONSTRAINT "_DumpPeople_A_fkey" FOREIGN KEY ("A") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DumpPeople" ADD CONSTRAINT "_DumpPeople_B_fkey" FOREIGN KEY ("B") REFERENCES "raw_dumps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InboxPeople" ADD CONSTRAINT "_InboxPeople_A_fkey" FOREIGN KEY ("A") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InboxPeople" ADD CONSTRAINT "_InboxPeople_B_fkey" FOREIGN KEY ("B") REFERENCES "smart_inbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActionItemPeople" ADD CONSTRAINT "_ActionItemPeople_A_fkey" FOREIGN KEY ("A") REFERENCES "actionable_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActionItemPeople" ADD CONSTRAINT "_ActionItemPeople_B_fkey" FOREIGN KEY ("B") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
