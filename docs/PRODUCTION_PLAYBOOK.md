# 🚀 AgroMind AI - Production Playbook

This playbook walks you through the exact steps to deploy the AgroMind AI MVP to production.

## Step 1: Provision the Database (Neon/Supabase)
1. Go to [Neon.tech](https://neon.tech/) and create a new project.
2. Copy the Connection String (make sure it says `?schema=public` at the end).

## Step 2: Provision Cloudinary
1. Go to [Cloudinary](https://cloudinary.com) and sign in.
2. On your Dashboard, copy the **Cloud Name**, **API Key**, and **API Secret**.

## Step 3: Deploy to Railway (Backend + AI)
Railway will read our `railway.toml` file and deploy both services automatically!
1. Go to [Railway.app](https://railway.app/) and click **New Project** -> **Deploy from GitHub repo**.
2. Select your `AgroMind-AI` repository.
3. Railway will detect two services (`backend` and `ai`).
4. **Environment Variables**:
   Go to the `backend` service settings -> Variables, and add:
   - `DATABASE_URL` = Your Neon connection string.
   - `JWT_SECRET` = Generate a random 32-character string.
   - `CLOUDINARY_CLOUD_NAME` = From Step 2
   - `CLOUDINARY_API_KEY` = From Step 2
   - `CLOUDINARY_API_SECRET` = From Step 2
   - `AI_SERVICE_URL` = `http://ai.railway.internal:8000` (Railway's internal networking!)
   
   Go to the `ai` service settings -> Variables, and add:
   - `CORS_ORIGINS` = `*` (Since we are in MVP public mode).

5. Generate Public Domains:
   In Railway, go to the **Settings > Networking** tab for the `backend` service and click **Generate Domain**. Note this URL (e.g., `https://agromind-backend.up.railway.app`).

## Step 4: Apply Database Migrations
1. In your local terminal, set your `DATABASE_URL` in `server/.env` to the Neon production URL.
2. Run `npm run prisma:deploy` from the `server/` directory.
3. This will create all the necessary tables in production.

## Step 5: Mobile App Deployment (Expo EAS)
1. Open `mobile/eas.json` and ensure `EXPO_PUBLIC_API_URL` is set to your new Railway backend domain.
2. Open your terminal in the `mobile/` directory.
3. Run `npx eas login`.
4. Run `npx eas build --platform android --profile production`.
5. Wait for the cloud build to finish, download the APK, and install it on your device!

## 🧪 Testing the MVP
Open the app. You should be able to scan a leaf immediately. Because we implemented the **Auth Bypass**, the scan will be saved under the anonymous MVP user in your database, completely skipping the login screen!
