const { transcribeAudio } = require('../services/voiceAssistantService');
const { askAssistant, getConversation, listConversations } = require('../services/assistantChatService');
const { sendSuccess } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const askByVoice = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Voice recording is required.', 400);
  }

  const result = await transcribeAudio(req.file.buffer, req.file.mimetype);

  const chat = await askAssistant({
    userId: req.user.id,
    question: result.transcript,
    language: result.language,
    location: {
      label: req.body.locationLabel || req.body.location,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
    },
    conversationId: req.body.conversationId,
  });

  return sendSuccess(res, 'Voice question answered successfully.', { conversation: chat });
});

const askByText = asyncHandler(async (req, res) => {
  const result = await askAssistant({
    userId: req.user.id,
    question: req.body.question,
    language: req.body.language,
    location: req.body.location,
    conversationId: req.body.conversationId,
  });

  return sendSuccess(res, 'Question answered successfully.', {
    conversation: result,
  });
});

const getAllConversations = asyncHandler(async (req, res) => {
  const conversations = await listConversations(req.user.id);
  return sendSuccess(res, 'Assistant conversations fetched.', { conversations });
});

const getOneConversation = asyncHandler(async (req, res) => {
  const conversation = await getConversation(req.user.id, req.params.id);
  return sendSuccess(res, 'Assistant conversation fetched.', { conversation });
});

module.exports = {
  askByText,
  askByVoice,
  getAllConversations,
  getOneConversation,
};
