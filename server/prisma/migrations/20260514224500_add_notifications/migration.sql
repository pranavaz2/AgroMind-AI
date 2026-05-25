CREATE TYPE "NotificationType" AS ENUM (
  'WEATHER_ALERT',
  'DISEASE_ALERT',
  'FARMING_REMINDER',
  'SCAN_COMPLETION'
);

CREATE TABLE "notification_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token" TEXT NOT NULL,
  "platform" TEXT,
  "device_name" TEXT,
  "user_id" UUID NOT NULL,
  "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" JSONB,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "farming_reminders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL DEFAULT 'FARMING_REMINDER',
  "scheduled_for" TIMESTAMP(3) NOT NULL,
  "is_recurring" BOOLEAN NOT NULL DEFAULT false,
  "recurrence_rule" TEXT,
  "last_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "farming_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_tokens_token_key" ON "notification_tokens"("token");
CREATE INDEX "notification_tokens_user_id_idx" ON "notification_tokens"("user_id");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "farming_reminders_user_id_scheduled_for_idx" ON "farming_reminders"("user_id", "scheduled_for");

ALTER TABLE "notification_tokens"
  ADD CONSTRAINT "notification_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "farming_reminders"
  ADD CONSTRAINT "farming_reminders_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
