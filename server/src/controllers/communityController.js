const {
  addComment,
  createCommunityPost,
  getCommunityFeed,
  getPostById,
  resolveQuestion,
  togglePostLike,
} = require('../services/communityService');
const { sendCreated, sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const createPost = asyncHandler(async (req, res) => {
  const post = await createCommunityPost({
    userId: req.user.id,
    body: req.body.body,
    title: req.body.title,
    type: req.body.type,
    cropName: req.body.cropName,
    location: req.body.location,
    imageFile: req.file,
  });

  return sendCreated(res, 'Community post created.', { post });
});

const getFeed = asyncHandler(async (req, res) => {
  const feed = await getCommunityFeed({
    userId: req.user.id,
    cursor: req.query.cursor,
    type: req.query.type,
  });

  return sendSuccess(res, 'Community feed fetched.', feed);
});

const getOne = asyncHandler(async (req, res) => {
  const post = await getPostById(req.params.id, req.user.id);
  return sendSuccess(res, 'Community post fetched.', { post });
});

const toggleLike = asyncHandler(async (req, res) => {
  const result = await togglePostLike(req.params.id, req.user.id);
  return sendSuccess(res, result.liked ? 'Post liked.' : 'Post unliked.', result);
});

const comment = asyncHandler(async (req, res) => {
  const newComment = await addComment({
    postId: req.params.id,
    userId: req.user.id,
    body: req.body.body,
  });

  return sendCreated(res, 'Comment added.', { comment: newComment });
});

const markResolved = asyncHandler(async (req, res) => {
  const post = await resolveQuestion(req.params.id, req.user.id, req.body.isResolved);
  return sendSuccess(res, 'Question updated.', { post });
});

module.exports = {
  comment,
  createPost,
  getFeed,
  getOne,
  markResolved,
  toggleLike,
};
