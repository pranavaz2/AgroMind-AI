import apiClient from './apiClient';

export async function askVoiceAssistant({ audioUri, location, conversationId }) {
  const formData = new FormData();
  const filename = audioUri.split('/').pop() || 'question.m4a';
  const extension = filename.split('.').pop()?.toLowerCase();
  const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/mp4';

  formData.append('audio', {
    uri: audioUri,
    name: filename,
    type: mimeType,
  });

  if (conversationId) {
    formData.append('conversationId', conversationId);
  }

  if (location?.label) {
    formData.append('locationLabel', location.label);
  }
  if (location?.latitude && location?.longitude) {
    formData.append('latitude', location.latitude);
    formData.append('longitude', location.longitude);
  }

  const response = await apiClient.post('/voice/ask', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  });

  return response.data.data;
}

export async function askTextAssistant({ question, language = 'english', location, conversationId }) {
  const response = await apiClient.post('/voice/text', {
    question,
    language,
    conversationId,
    location: location ? {
      label: location.label,
      latitude: location.latitude,
      longitude: location.longitude,
    } : null,
  }, {
    timeout: 60000,
  });

  return response.data.data;
}

export async function getAssistantConversations() {
  const response = await apiClient.get('/voice/conversations');
  return response.data.data;
}

export async function getAssistantConversation(conversationId) {
  const response = await apiClient.get(`/voice/conversations/${conversationId}`);
  return response.data.data;
}
