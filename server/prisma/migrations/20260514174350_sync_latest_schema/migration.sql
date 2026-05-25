-- AlterTable
ALTER TABLE IF EXISTS "assistant_conversations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "assistant_messages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "community_comments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "community_likes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "community_posts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "farming_reminders" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "notification_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "notifications" ALTER COLUMN "id" DROP DEFAULT;
