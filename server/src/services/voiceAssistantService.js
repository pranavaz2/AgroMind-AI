const genAI = require('../config/gemini');
const AppError = require('../utils/AppError');

const MODEL_NAME = 'gemini-2.5-flash';

const VOICE_ASSISTANT_SYSTEM_PROMPT = `You are AgroMind AI's voice assistant for farmers.

Answer farming questions in simple, practical language.

Rules:
1. Keep the answer short enough to speak aloud in under 45 seconds.
2. Use clear steps and avoid technical jargon.
3. If the question is in Malayalam, answer in Malayalam.
4. If the question asks about pesticide, fertilizer, disease, or animal/human safety, include a safety note.
5. If you are unsure, say what to check next instead of guessing.
6. Do not mention that you are a language model.`;

function cleanJsonText(text) {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

async function transcribeAudio(audioBuffer, mimeType) {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new AppError('No voice recording was provided.', 400);
  }

  try {
    const response = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: audioBuffer.toString('base64'),
                mimeType: mimeType || 'audio/mp4',
              },
            },
            {
              text: `Transcribe this farmer's voice question. Detect the language.
Return ONLY valid JSON:
{
  "transcript": "exact spoken question",
  "language": "english|malayalam|hindi|other"
}`,
            },
          ],
        },
      ],
    });

    const rawText = response.text;
    if (!rawText) {
      throw new AppError('Speech recognition returned an empty response.', 502);
    }

    const parsed = JSON.parse(cleanJsonText(rawText));
    const transcript = parsed.transcript?.trim();

    if (!transcript) {
      throw new AppError('Could not understand the recording. Please try again.', 422);
    }

    return {
      transcript,
      language: parsed.language || 'english',
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error instanceof SyntaxError) {
      throw new AppError('Speech recognition returned an invalid response.', 502);
    }

    throw new AppError(`Speech recognition failed: ${error.message || 'Unknown error'}`, 502);
  }
}

async function answerFarmingQuestion({ question, language = 'english', location = null }) {
  if (!question || !question.trim()) {
    throw new AppError('Question is required.', 400);
  }

  try {
    const response = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${VOICE_ASSISTANT_SYSTEM_PROMPT}

Detected language: ${language}
Farmer location: ${location || 'not provided'}
Question: ${question.trim()}

Return ONLY valid JSON:
{
  "answer": "short spoken answer for the farmer",
  "suggestions": ["next step 1", "next step 2", "next step 3"],
  "language": "${language}"
}`,
            },
          ],
        },
      ],
    });

    const rawText = response.text;
    if (!rawText) {
      throw new AppError('AI assistant returned an empty response.', 502);
    }

    const parsed = JSON.parse(cleanJsonText(rawText));

    return {
      answer: parsed.answer?.trim() || 'I could not prepare an answer. Please ask again.',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
      language: parsed.language || language,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error instanceof SyntaxError) {
      throw new AppError('AI assistant returned an invalid response.', 502);
    }

    throw new AppError(`AI assistant failed: ${error.message || 'Unknown error'}`, 502);
  }
}

async function handleVoiceQuestion({ audioBuffer, mimeType, location }) {
  const speech = await transcribeAudio(audioBuffer, mimeType);
  const ai = await answerFarmingQuestion({
    question: speech.transcript,
    language: speech.language,
    location,
  });

  return {
    transcript: speech.transcript,
    answer: ai.answer,
    suggestions: ai.suggestions,
    language: ai.language,
  };
}

module.exports = {
  answerFarmingQuestion,
  handleVoiceQuestion,
  transcribeAudio,
};
