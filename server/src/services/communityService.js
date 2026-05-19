const { prisma } = require('../config/db');
const { uploadImage } = require('./uploadService');
const AppError = require('../utils/AppError');

const POST_TYPES = new Set(['POST', 'QUESTION']);
const PAGE_SIZE = 15;

function parseCursor(cursor) {
  if (!cursor) return null;
  const date = new Date(cursor);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAuthor(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    location: user.location,
  };
}

function formatComment(comment) {
  return {
    id: comment.id,
    body: comment.body,
    author: formatAuthor(comment.author),
    createdAt: comment.createdAt,
  };
}

function formatPost(post, userId) {
  return {
    id: post.id,
    type: post.type,
    title: post.title,
    body: post.body,
    imageUrl: post.imageUrl,
    cropName: post.cropName,
    location: post.location,
    isResolved: post.isResolved,
    author: formatAuthor(post.author),
    likeCount: post._count?.likes || 0,
    commentCount: post._count?.comments || 0,
    isLikedByMe: post.likes?.some((like) => like.userId === userId) || false,
    recentComments: (post.comments || []).map(formatComment),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function createCommunityPost({ userId, body, title, type, cropName, location, imageFile }) {
  const cleanBody = body?.trim();
  const postType = type || 'POST';

  if (!cleanBody) {
    throw new AppError('Post text is required.', 400);
  }
  if (!POST_TYPES.has(postType)) {
    throw new AppError('Post type must be POST or QUESTION.', 400);
  }
  if (postType === 'QUESTION' && !title?.trim()) {
    throw new AppError('Questions need a short title.', 400);
  }

  let uploadResult = null;
  if (imageFile) {
    uploadResult = await uploadImage(imageFile.buffer, {
      folder: 'community',
      userId,
    });
  }

  const post = await prisma.communityPost.create({
    data: {
      authorId: userId,
      type: postType,
      title: title?.trim() || null,
      body: cleanBody,
      cropName: cropName?.trim() || null,
      location: location?.trim() || null,
      imageUrl: uploadResult?.url || null,
      imagePublicId: uploadResult?.publicId || null,
    },
    include: getPostIncludes(userId),
  });

  return formatPost(post, userId);
}

function getPostIncludes(userId) {
  return {
    author: {
      select: { id: true, fullName: true, location: true },
    },
    likes: {
      where: { userId },
      select: { userId: true },
    },
    comments: {
      take: 2,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, fullName: true, location: true },
        },
      },
    },
    _count: {
      select: { likes: true, comments: true },
    },
  };
}

async function getCommunityFeed({ userId, cursor, type }) {
  const cursorDate = parseCursor(cursor);
  const where = {};

  if (type && POST_TYPES.has(type)) {
    where.type = type;
  }
  if (cursorDate) {
    where.createdAt = { lt: cursorDate };
  }

  const posts = await prisma.communityPost.findMany({
    where,
    take: PAGE_SIZE + 1,
    orderBy: { createdAt: 'desc' },
    include: getPostIncludes(userId),
  });

  const hasMore = posts.length > PAGE_SIZE;
  const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  return {
    posts: page.map((post) => formatPost(post, userId)),
    nextCursor: hasMore ? page[page.length - 1]?.createdAt : null,
    hasMore,
  };
}

async function getPostById(postId, userId) {
  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    include: {
      ...getPostIncludes(userId),
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: { id: true, fullName: true, location: true },
          },
        },
      },
    },
  });

  if (!post) {
    throw new AppError('Community post not found.', 404);
  }

  return formatPost(post, userId);
}

async function togglePostLike(postId, userId) {
  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) throw new AppError('Community post not found.', 404);

  const existing = await prisma.communityLike.findUnique({
    where: {
      postId_userId: { postId, userId },
    },
  });

  if (existing) {
    await prisma.communityLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.communityLike.create({ data: { postId, userId } });
  }

  const likeCount = await prisma.communityLike.count({ where: { postId } });
  return { liked: !existing, likeCount };
}

async function addComment({ postId, userId, body }) {
  const cleanBody = body?.trim();
  if (!cleanBody) throw new AppError('Comment text is required.', 400);

  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) throw new AppError('Community post not found.', 404);

  const comment = await prisma.communityComment.create({
    data: { postId, authorId: userId, body: cleanBody },
    include: {
      author: {
        select: { id: true, fullName: true, location: true },
      },
    },
  });

  return formatComment(comment);
}

async function resolveQuestion(postId, userId, isResolved = true) {
  const post = await prisma.communityPost.findFirst({
    where: { id: postId, authorId: userId },
  });

  if (!post) {
    throw new AppError('Question not found or not owned by you.', 404);
  }
  if (post.type !== 'QUESTION') {
    throw new AppError('Only questions can be marked as resolved.', 400);
  }

  const updated = await prisma.communityPost.update({
    where: { id: postId },
    data: { isResolved: Boolean(isResolved) },
    include: getPostIncludes(userId),
  });

  return formatPost(updated, userId);
}

module.exports = {
  addComment,
  createCommunityPost,
  getCommunityFeed,
  getPostById,
  resolveQuestion,
  togglePostLike,
};
