-- AlterTable
ALTER TABLE "assistant_conversations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "assistant_messages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "community_comments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "community_likes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "community_posts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "farming_reminders" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT;
