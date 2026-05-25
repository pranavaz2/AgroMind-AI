import apiClient from './apiClient';

export async function getCurrentWeather({ latitude, longitude }) {
  const response = await apiClient.get('/weather/current', {
    params: {
      lat: latitude,
      lon: longitude,
    },
  });

  return response.data.data;
}
