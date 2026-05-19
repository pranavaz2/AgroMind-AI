# 🚀 AgroMind AI — Final Live Launch Guide

This masterclass document walks you through the exact steps, networking concepts, and architectural decisions required to take AgroMind AI publicly live on the internet.

---

## 🏗️ Production Deployment Architecture
When moving from `localhost` to production, networking changes drastically. 

### 1. Railway Service Communication (The Private Network)
You have two services deployed to Railway: the **Node.js Orchestrator** and the **FastAPI AI Service**.
- **Public Traffic**: Only the Node.js Orchestrator is exposed to the public internet (via a `https://agromind-backend.up.railway.app` URL). The React Native app talks *only* to this Node URL.
- **Private Traffic**: The FastAPI service does NOT need a public URL. Node.js communicates with FastAPI over Railway's **internal private network** (e.g., `http://ai.railway.internal:8000`). This is inherently secure, massively reduces latency, and saves bandwidth costs because traffic never leaves the Railway data center!

### 2. FastAPI Production Optimization
The MobileNetV2 model is heavily optimized for production:
- **Uvicorn Lifespan**: We used the `@asynccontextmanager` lifespan event to load the 15MB `.keras` model into RAM *only once* when the server boots. 
- **Cold Starts**: If Railway puts the AI service to sleep due to inactivity, the next scan will experience a "Cold Start" (taking ~3-5 seconds to boot and load the model). We configured `AI_SERVICE_TIMEOUT_MS=30000` in Node.js to ensure the orchestrator waits patiently during this cold start rather than crashing.

---

## 🛠️ Step-by-Step Deployment Execution

### Step 1: Provision Neon PostgreSQL
1. Go to [Neon.tech](https://neon.tech/) and create a free project.
2. Copy the **Postgres Connection String** (ensure it ends with `?schema=public`).
3. In your local terminal, paste this string into `server/.env` under `DATABASE_URL`.
4. Run `npm run prisma:deploy` to push your SQL tables to the live Neon database.

### Step 2: Configure Cloudinary
1. Go to [Cloudinary](https://cloudinary.com/) and navigate to the Dashboard.
2. Copy your **Cloud Name**, **API Key**, and **API Secret**. 

### Step 3: Deploy to Railway
1. Go to [Railway.app](https://railway.app/) and create an account.
2. Click **New Project** → **Deploy from GitHub Repo** → Select `AgroMind-AI`.
3. Railway will detect the `railway.toml` file and automatically create two services: `backend` and `ai`.

### Step 4: Configure Exact Environment Variables
In Railway, click the **`backend`** service, go to **Variables**, and add:
- `NODE_ENV` = `production`
- `PORT` = `5000`
- `DATABASE_URL` = `[Your Neon String]`
- `JWT_SECRET` = `[Random 32 character string]`
- `CLOUDINARY_CLOUD_NAME` = `[From Step 2]`
- `CLOUDINARY_API_KEY` = `[From Step 2]`
- `CLOUDINARY_API_SECRET` = `[From Step 2]`
- `AI_SERVICE_URL` = `http://ai.railway.internal:8000` *(This uses Railway's private networking!)*

In Railway, click the **`ai`** service, go to **Variables**, and add:
- `CORS_ORIGINS` = `*`

### Step 5: Generate Public Domains
1. In Railway, go to the **`backend`** service → **Settings** → **Networking**.
2. Click **Generate Domain**. Railway will instantly provide an SSL-secured HTTPS domain (e.g., `https://backend-production.up.railway.app`).
3. Copy this domain.

### Step 6: Expo EAS Production Build
1. Open `mobile/eas.json` in your code editor.
2. Change `EXPO_PUBLIC_API_URL` to your new Railway backend domain (e.g., `https://backend-production.up.railway.app/api/v1`).
3. Open your terminal in the `mobile/` directory.
4. Run `npx eas login`.
5. Run `npx eas build --platform android --profile production`.
6. Download the resulting `.apk` and install it on your Android phone!

---

## 🌍 Public MVP Considerations
Because we implemented the `optionalAuth` bypass:
- **No Login Required**: Anyone who downloads your APK can immediately scan a leaf. 
- **Database Safety**: All scans are safely isolated under the `00000000-0000-0000-0000-000000000000` UUID. 
- **Security Check**: This ensures recruiters and friends don't hit a friction-heavy signup screen when testing your app, while guaranteeing your Prisma schema remains perfectly structured for future JWT enforcement.
