const AppError = require('../utils/AppError');
const env = require('../config/env');

const OPENWEATHER_CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather';

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildWeatherInsights(weather) {
  const temperature = weather.temperature;
  const humidity = weather.humidity;
  const windSpeed = weather.windSpeed;
  const rainChance = weather.isRaining;
  const alerts = [];
  const suggestions = [];

  if (rainChance || weather.rainLastHour > 0) {
    alerts.push({
      type: 'rain',
      severity: 'warning',
      title: 'Rain alert',
      message: 'Delay pesticide spraying and keep harvested produce covered.',
    });
    suggestions.push('Pause spraying until leaves are dry to avoid chemical runoff.');
  }

  if (temperature >= 38) {
    alerts.push({
      type: 'heat',
      severity: 'danger',
      title: 'Heat warning',
      message: 'High heat can stress crops and increase irrigation demand.',
    });
    suggestions.push('Irrigate during early morning or evening to reduce evaporation.');
  } else if (temperature >= 34) {
    alerts.push({
      type: 'heat',
      severity: 'warning',
      title: 'Warm field conditions',
      message: 'Monitor young plants for wilting during peak afternoon heat.',
    });
  }

  if (humidity >= 80) {
    suggestions.push('High humidity can favor fungal disease; inspect leaves closely.');
  } else if (humidity <= 35) {
    suggestions.push('Low humidity may dry topsoil quickly; check soil moisture before noon.');
  }

  if (windSpeed >= 8) {
    alerts.push({
      type: 'wind',
      severity: 'warning',
      title: 'Windy conditions',
      message: 'Avoid spraying while winds are strong to prevent drift.',
    });
  }

  if (!suggestions.length) {
    suggestions.push('Weather looks suitable for routine field inspection and light farm work.');
  }

  const score = Math.max(
    35,
    100
      - (temperature >= 38 ? 25 : temperature >= 34 ? 12 : 0)
      - (humidity >= 85 ? 14 : humidity >= 80 ? 8 : 0)
      - (rainChance ? 22 : 0)
      - (windSpeed >= 8 ? 10 : 0)
  );

  const status =
    score >= 80 ? 'Excellent' :
    score >= 65 ? 'Good' :
    score >= 50 ? 'Caution' :
    'Risky';

  return {
    status,
    score,
    alerts,
    suggestions: suggestions.slice(0, 4),
    summary: suggestions[0],
  };
}

function normalizeOpenWeatherPayload(payload) {
  const current = payload.weather?.[0] || {};
  const main = payload.main || {};
  const wind = payload.wind || {};
  const rain = payload.rain || {};

  const weather = {
    location: {
      name: payload.name || 'Current location',
      country: payload.sys?.country || null,
      latitude: payload.coord?.lat,
      longitude: payload.coord?.lon,
    },
    condition: current.main || 'Weather',
    description: current.description || 'Current conditions',
    icon: current.icon || null,
    temperature: Math.round(toNumber(main.temp) || 0),
    feelsLike: Math.round(toNumber(main.feels_like) || 0),
    humidity: Math.round(toNumber(main.humidity) || 0),
    pressure: Math.round(toNumber(main.pressure) || 0),
    windSpeed: Number((toNumber(wind.speed) || 0).toFixed(1)),
    cloudCover: Math.round(toNumber(payload.clouds?.all) || 0),
    rainLastHour: Number((toNumber(rain['1h']) || 0).toFixed(1)),
    isRaining: /rain|drizzle|thunderstorm/i.test(`${current.main} ${current.description}`),
    observedAt: payload.dt ? new Date(payload.dt * 1000).toISOString() : new Date().toISOString(),
  };

  return {
    ...weather,
    insights: buildWeatherInsights(weather),
  };
}

async function getCurrentWeather({ latitude, longitude }) {
  if (!env.openWeatherApiKey) {
    throw new AppError('OpenWeather API key is not configured on the server.', 503);
  }

  const lat = toNumber(latitude);
  const lon = toNumber(longitude);

  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new AppError('Valid latitude and longitude are required.', 400);
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: env.openWeatherApiKey,
    units: 'metric',
  });

  let response;
  let payload;

  try {
    response = await fetch(`${OPENWEATHER_CURRENT_URL}?${params.toString()}`);
    payload = await response.json().catch(() => ({}));
  } catch (error) {
    throw new AppError('Unable to reach OpenWeather. Please try again later.', 502);
  }

  if (!response.ok) {
    const message = payload.message || 'Weather provider request failed.';
    throw new AppError(`OpenWeather error: ${message}`, response.status === 401 ? 503 : response.status);
  }

  return normalizeOpenWeatherPayload(payload);
}

module.exports = {
  getCurrentWeather,
};
