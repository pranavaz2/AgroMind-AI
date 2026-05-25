import apiClient from './apiClient';

function appendIfPresent(formData, key, value) {
  if (value !== undefined && value !== null && String(value).trim()) {
    formData.append(key, String(value).trim());
  }
}

export async function getCommunityFeed({ cursor, type } = {}) {
  const response = await apiClient.get('/community', {
    params: {
      cursor,
      type: type === 'ALL' ? undefined : type,
    },
  });

  return response.data.data;
}

export async function createCommunityPost({ body, title, type, cropName, location, imageUri }) {
  const formData = new FormData();
  appendIfPresent(formData, 'body', body);
  appendIfPresent(formData, 'title', title);
  appendIfPresent(formData, 'type', type || 'POST');
  appendIfPresent(formData, 'cropName', cropName);
  appendIfPresent(formData, 'location', location);

  if (imageUri) {
    const filename = imageUri.split('/').pop() || 'community.jpg';
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';

    formData.append('image', {
      uri: imageUri,
      name: filename,
      type: mimeType,
    });
  }

  const response = await apiClient.post('/community', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45000,
  });

  return response.data.data;
}

export async function toggleCommunityLike(postId) {
  const response = await apiClient.post(`/community/${postId}/like`);
  return response.data.data;
}

export async function addCommunityComment(postId, body) {
  const response = await apiClient.post(`/community/${postId}/comments`, { body });
  return response.data.data;
}

export async function markQuestionResolved(postId, isResolved = true) {
  const response = await apiClient.patch(`/community/${postId}/resolve`, { isResolved });
  return response.data.data;
}
