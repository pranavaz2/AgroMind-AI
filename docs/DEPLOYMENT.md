# 🚀 Production Deployment Guide

This guide details the steps to deploy the AgroMind AI microservice architecture to a production environment.

## 1. AI Inference Service (FastAPI)
The AI service requires a Python environment capable of running TensorFlow. 
**Recommended Hosts:** Render, Railway, or Google Cloud Run.

### Deployment Steps (Railway Example):
1. Connect your repository to Railway.
2. Select the `ai-service` directory.
3. Railway will automatically detect the `requirements.txt` and install dependencies.
4. Set the Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Note the generated URL (e.g., `https://agromind-ai-production.up.railway.app`).

> [!WARNING]
> Ensure the production server has at least 1GB of RAM. The MobileNetV2 TensorFlow graph consumes ~200-300MB upon startup.

## 2. PostgreSQL Database
**Recommended Hosts:** Neon.tech, Supabase, or Railway.

1. Create a new PostgreSQL instance.
2. Copy the connection string. It will look like: `postgresql://user:pass@host:5432/db?schema=public`.

## 3. Cloudinary Setup
1. Create a free account at [Cloudinary](https://cloudinary.com).
2. Go to your Dashboard and note your Cloud Name, API Key, and API Secret.

## 4. Orchestrator Backend (Node.js)
**Recommended Hosts:** Render or Railway.

### Environment Variables:
```env
PORT=5000
NODE_ENV=production
DATABASE_URL="your-postgresql-url"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
AI_SERVICE_URL="https://agromind-ai-production.up.railway.app" # URL from Step 1
```

### Deployment Steps:
1. Connect your repository.
2. Select the `server` directory.
3. Build Command: `npm install && npx prisma generate`
4. Start Command: `npm run start` (ensure this points to `node src/server.js`).
5. After deployment, run `npx prisma migrate deploy` to set up the production database schema.
6. Note the backend URL (e.g., `https://agromind-backend.onrender.com`).

## 5. Mobile Frontend (React Native Expo)
**Recommended Hosts:** Expo Application Services (EAS).

1. Update `mobile/src/services/apiClient.js` to point your `baseURL` to the production Node.js orchestrator URL.
2. Install EAS CLI: `npm install -g eas-cli`.
3. Login: `eas login`.
4. Configure EAS: `eas build:configure`.
5. Build the APK/AAB for Android: `eas build --platform android --profile production`.
6. Download and publish the binary to the Google Play Store!
