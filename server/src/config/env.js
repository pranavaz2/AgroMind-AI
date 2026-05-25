const dotenv = require('dotenv');

dotenv.config();

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'GEMINI_API_KEY'];

if (process.env.NODE_ENV === 'production') {
  requiredEnv.push('CLIENT_URL');
}

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL,
  isProduction: process.env.NODE_ENV === 'production',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
  aiProvider: process.env.AI_PROVIDER || 'auto',
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
};

module.exports = env;
