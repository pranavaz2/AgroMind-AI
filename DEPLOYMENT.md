# AgroMind Deployment

This project deploys as three backend resources and one mobile build:

- `agromind-postgres`: PostgreSQL database
- `agromind-ai-service`: FastAPI TensorFlow prediction service
- `agromind-api`: Express API, Prisma, Cloudinary, Gemini fallback, weather, auth
- Expo/EAS mobile app build

## 1. Backend on Render

Use the root `render.yaml` blueprint.

Before creating the blueprint, set these secret environment variables in Render:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GEMINI_API_KEY`
- `OPENWEATHER_API_KEY`

The blueprint generates `JWT_SECRET` and wires `DATABASE_URL` from the managed Postgres database.

After deploy, verify:

```bash
curl https://agromind-api.onrender.com/api/v1/health
curl https://agromind-ai-service.onrender.com/api/v1/health
```

If Render assigns a different API URL, update `mobile/eas.json`:

```json
"EXPO_PUBLIC_API_BASE_URL": "https://your-api-service.onrender.com/api/v1"
```

## 2. AI Model

The Python service currently works with demo fallback when no trained model exists.

For real predictions, deploy this file:

```text
ai-service/models/leaf_disease_model.keras
```

Then set:

```env
ENABLE_DEMO_FALLBACK=false
```

Keep `AI_CLASS_NAMES` in the same order as the model output neurons.

## 3. Mobile App with EAS

From `mobile/`:

```bash
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

For Play Store / App Store builds:

```bash
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

## Security

Do not deploy or commit local `.env` files. Rotate any secrets that were shared or committed before deploying.
