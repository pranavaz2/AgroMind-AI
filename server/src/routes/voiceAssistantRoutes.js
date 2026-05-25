const express = require('express');
const multer = require('multer');
const {
  askByText,
  askByVoice,
  getAllConversations,
  getOneConversation,
} = require('../controllers/voiceAssistantController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

router.use(protect);

router.get('/conversations', getAllConversations);
router.get('/conversations/:id', getOneConversation);
router.post('/ask', upload.single('audio'), askByVoice);
router.post('/text', askByText);

module.exports = router;
