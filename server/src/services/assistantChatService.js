const genAI = require('../config/gemini');
const { prisma } = require('../config/db');
const AppError = require('../utils/AppError');
const { getCurrentWeather } = require('./weatherService');

const MODEL_NAME = 'gemini-2.5-flash';
const RECENT_MESSAGE_LIMIT = 10;

const FARMING_CHAT_PROMPT = `You are AgroMind AI, a professional farming assistant for small and medium farmers.

Your role:
- Give practical, farmer-friendly guidance for crops, diseases, fertilizer, irrigation, pest control, soil health, and weather decisions.
- Use simple language, short paragraphs, and clear numbered steps.
- Prefer locally safe advice. If exact crop, growth stage, soil type, weather, or location is missing, ask one helpful follow-up question after giving general guidance.
- For disease or pest advice, include immediate field checks, organic options, and chemical-use safety notes.
- For fertilizer advice, mention soil testing and avoid exact chemical dosage unless crop/stage/acreage is known.
- For irrigation advice, consider soil moisture, crop stage, heat, rain, and drainage.
- For weather-based guidance, explain what to do today and what to avoid.
- Do not claim certainty where image/lab inspection is needed.
- Do not mention that you are a language model.`;

function cleanJsonText(text) {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function normalizeLocation(location) {
  if (!location) return null;
  if (typeof location === 'string') return { label: location };
  return {
    label: location.label || null,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

async function buildWeatherContext(location) {
  const lat = Number(location?.latitude);
  const lon = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  try {
    const weather = await getCurrentWeather({ latitude: lat, longitude: lon });
    return {
      condition: weather.condition,
      description: weather.description,
      temperature: weather.temperature,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      rainLastHour: weather.rainLastHour,
      farmScore: weather.insights?.status,
      alerts: weather.insights?.alerts || [],
      summary: weather.insights?.summary,
    };
  } catch {
    return null;
  }
}

function formatMessage(message) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    metadata: message.metadata || {},
    createdAt: message.createdAt,
  };
}

function buildTitle(question) {
  return question.trim().slice(0, 58) || 'Farming chat';
}

async function getOrCreateConversation({ userId, conversationId, question }) {
  if (conversationId) {
    const conversation = await prisma.assistantConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new AppError('Conversation not found.', 404);
    return conversation;
  }

  return prisma.assistantConversation.create({
    data: {
      userId,
      title: buildTitle(question),
    },
  });
}

async function callGeminiForAnswer({ question, language, location, weather, memorySummary, recentMessages }) {
  const response = await genAI.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${FARMING_CHAT_PROMPT}

Farmer language preference: ${language || 'english'}
Farmer location: ${location?.label || 'not provided'}
Live weather context: ${weather ? JSON.stringify(weather) : 'not available'}
Conversation memory summary: ${memorySummary || 'none yet'}
Recent conversation messages: ${JSON.stringify(recentMessages.map((message) => ({
  role: message.role,
  content: message.content,
})))}

Farmer's latest question:
${question.trim()}

Return ONLY valid JSON:
{
  "answer": "farmer-friendly answer with practical steps",
  "category": "disease|fertilizer|irrigation|weather|pest|soil|general",
  "suggestedActions": ["action 1", "action 2", "action 3"],
  "safetyNotes": ["safety note if relevant"],
  "followUpQuestions": ["one concise question if more details are needed"],
  "memorySummary": "short updated memory of important farmer context and advice so far",
  "language": "${language || 'english'}"
}`,
          },
        ],
      },
    ],
  });

  const rawText = response.text;
  if (!rawText) throw new AppError('AI assistant returned an empty response.', 502);

  try {
    const parsed = JSON.parse(cleanJsonText(rawText));
    return {
      answer: parsed.answer?.trim() || 'I could not prepare a clear answer. Please ask again with crop and location details.',
      category: parsed.category || 'general',
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions.slice(0, 4) : [],
      safetyNotes: Array.isArray(parsed.safetyNotes) ? parsed.safetyNotes.slice(0, 3) : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions.slice(0, 2) : [],
      memorySummary: parsed.memorySummary || memorySummary || null,
      language: parsed.language || language || 'english',
    };
  } catch {
    throw new AppError('AI assistant returned an invalid response format.', 502);
  }
}

async function askAssistant({ userId, question, language = 'english', location, conversationId }) {
  if (!question?.trim()) throw new AppError('Question is required.', 400);

  const normalizedLocation = normalizeLocation(location);
  const conversation = await getOrCreateConversation({ userId, conversationId, question });

  const recentMessages = await prisma.assistantMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: RECENT_MESSAGE_LIMIT,
  });
  recentMessages.reverse();

  const weather = await buildWeatherContext(normalizedLocation);

  const userMessage = await prisma.assistantMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      content: question.trim(),
      metadata: {
        language,
        location: normalizedLocation,
        weather,
      },
    },
  });

  const ai = await callGeminiForAnswer({
    question,
    language,
    location: normalizedLocation,
    weather,
    memorySummary: conversation.memorySummary,
    recentMessages,
  });

  const assistantMessage = await prisma.assistantMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: ai.answer,
      metadata: {
        category: ai.category,
        suggestedActions: ai.suggestedActions,
        safetyNotes: ai.safetyNotes,
        followUpQuestions: ai.followUpQuestions,
        language: ai.language,
      },
    },
  });

  const updatedConversation = await prisma.assistantConversation.update({
    where: { id: conversation.id },
    data: {
      memorySummary: ai.memorySummary,
      lastMessageAt: new Date(),
      title: conversation.title === 'Farming chat' ? buildTitle(question) : conversation.title,
    },
  });

  return {
    conversation: {
      id: updatedConversation.id,
      title: updatedConversation.title,
      memorySummary: updatedConversation.memorySummary,
      lastMessageAt: updatedConversation.lastMessageAt,
    },
    messages: [formatMessage(userMessage), formatMessage(assistantMessage)],
    answer: ai.answer,
    suggestions: ai.suggestedActions,
    safetyNotes: ai.safetyNotes,
    followUpQuestions: ai.followUpQuestions,
    category: ai.category,
    language: ai.language,
    transcript: question.trim(),
  };
}

async function listConversations(userId) {
  const conversations = await prisma.assistantConversation.findMany({
    where: { userId },
    orderBy: { lastMessageAt: 'desc' },
    take: 20,
    include: {
      _count: { select: { messages: true } },
    },
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    lastMessageAt: conversation.lastMessageAt,
    messageCount: conversation._count.messages,
  }));
}

async function getConversation(userId, conversationId) {
  const conversation = await prisma.assistantConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) throw new AppError('Conversation not found.', 404);

  return {
    id: conversation.id,
    title: conversation.title,
    memorySummary: conversation.memorySummary,
    lastMessageAt: conversation.lastMessageAt,
    messages: conversation.messages.map(formatMessage),
  };
}

module.exports = {
  askAssistant,
  getConversation,
  listConversations,
};
