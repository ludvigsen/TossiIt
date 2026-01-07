-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "google_refresh_token" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_dumps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "content_text" TEXT,
    "media_url" TEXT,
    "source_type" TEXT NOT NULL,
    "embedding" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_dumps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smart_inbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dump_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "proposed_data" JSONB NOT NULL,
    "ai_confidence_score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "flag_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smart_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6),
    "is_all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "category" TEXT,
    "gcal_event_id" TEXT,
    "origin_dump_id" UUID,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "smart_inbox_dump_id_key" ON "smart_inbox"("dump_id");

-- AddForeignKey
ALTER TABLE "raw_dumps" ADD CONSTRAINT "raw_dumps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_inbox" ADD CONSTRAINT "smart_inbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_inbox" ADD CONSTRAINT "smart_inbox_dump_id_fkey" FOREIGN KEY ("dump_id") REFERENCES "raw_dumps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_origin_dump_id_fkey" FOREIGN KEY ("origin_dump_id") REFERENCES "raw_dumps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
