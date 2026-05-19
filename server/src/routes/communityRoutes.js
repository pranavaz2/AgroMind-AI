const express = require('express');
const {
  comment,
  createPost,
  getFeed,
  getOne,
  markResolved,
  toggleLike,
} = require('../controllers/communityController');
const { protect } = require('../middleware/authMiddleware');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getFeed);
router.post('/', upload.single('image'), handleMulterError, createPost);
router.get('/:id', getOne);
router.post('/:id/like', toggleLike);
router.post('/:id/comments', comment);
router.patch('/:id/resolve', markResolved);

module.exports = router;
