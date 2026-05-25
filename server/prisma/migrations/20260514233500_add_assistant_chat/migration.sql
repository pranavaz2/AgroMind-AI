CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "assistant_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'Farming chat',
  "memory_summary" TEXT,
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "role" "ChatRole" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_conversations_user_id_last_message_at_idx"
  ON "assistant_conversations"("user_id", "last_message_at");

CREATE INDEX "assistant_messages_conversation_id_created_at_idx"
  ON "assistant_messages"("conversation_id", "created_at");

ALTER TABLE "assistant_conversations"
  ADD CONSTRAINT "assistant_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_messages"
  ADD CONSTRAINT "assistant_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
