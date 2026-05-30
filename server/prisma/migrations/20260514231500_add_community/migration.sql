CREATE TYPE "CommunityPostType" AS ENUM ('POST', 'QUESTION');

CREATE TABLE "community_posts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "author_id" UUID NOT NULL,
  "type" "CommunityPostType" NOT NULL DEFAULT 'POST',
  "title" TEXT,
  "body" TEXT NOT NULL,
  "image_url" TEXT,
  "image_public_id" TEXT,
  "crop_name" TEXT,
  "location" TEXT,
  "is_resolved" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_comments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_likes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "community_likes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_posts_created_at_idx" ON "community_posts"("created_at");
CREATE INDEX "community_posts_author_id_created_at_idx" ON "community_posts"("author_id", "created_at");
CREATE INDEX "community_comments_post_id_created_at_idx" ON "community_comments"("post_id", "created_at");
CREATE INDEX "community_comments_author_id_created_at_idx" ON "community_comments"("author_id", "created_at");
CREATE UNIQUE INDEX "community_likes_post_id_user_id_key" ON "community_likes"("post_id", "user_id");
CREATE INDEX "community_likes_user_id_created_at_idx" ON "community_likes"("user_id", "created_at");

ALTER TABLE "community_posts"
  ADD CONSTRAINT "community_posts_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_comments"
  ADD CONSTRAINT "community_comments_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_comments"
  ADD CONSTRAINT "community_comments_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_likes"
  ADD CONSTRAINT "community_likes_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_likes"
  ADD CONSTRAINT "community_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
