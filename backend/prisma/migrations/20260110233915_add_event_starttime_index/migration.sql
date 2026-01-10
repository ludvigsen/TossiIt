-- CreateIndex
CREATE INDEX "events_user_id_start_time_idx" ON "events"("user_id", "start_time");
