# 🚨 Production Troubleshooting & Monitoring

When AgroMind AI goes live, things will occasionally fail (network drops, cold starts, corrupted images). This document outlines how to monitor, debug, and recover your production environment.

## 1. Production Verification Checklist
After installing the Android APK, run through this test suite over a cellular network (disconnect from WiFi):

- [ ] **Cold Start Test**: Wait 30 minutes for Railway to sleep. Open the app and scan a leaf. Verify that the app says "Analyzing..." for a few seconds (as the AI boots up) and eventually returns the result without crashing.
- [ ] **Upload Progress UX**: Take a high-resolution photo (5MB+). Ensure the `Uploading... X%` UI smoothly counts up to 100 before transitioning to "Analyzing".
- [ ] **AI Accuracy**: Point the camera at a non-plant object (e.g., a keyboard). Verify that the AI returns a confidence score below 70% and the yellow warning banner appears.
- [ ] **Database Persistence**: Open DBeaver or Prisma Studio connected to your Neon database. Verify a new `CropScan` row exists with the full JSON metadata in the `aiSummary` column.
- [ ] **Fail-Fast Verification**: Shut down the `ai` service in Railway manually. Attempt a scan on the mobile app. Verify that the app instantly shows the "AI Service is currently offline" red banner and presents the "Retry Analysis" button.

---

## 2. Monitoring & Logging Strategy

### Application Logging
In Railway, click on either service and go to the **Deploy Logs** tab. 
- You will see standard `stdout` logs.
- Because we separated `morgan('dev')` to only run in development, production logs will be clean.
- Look out for `unhandledRejection` or `uncaughtException` logs, which trigger our graceful shutdown protocol.

### Uptime Monitoring
To ensure the orchestrator never sleeps and is always available:
1. Create a free account at [UptimeRobot](https://uptimerobot.com/).
2. Create an HTTP ping targeting `https://[your-railway-domain]/api/v1/health`.
3. Set the interval to 5 minutes. This keeps the Node.js server awake indefinitely.

### Error Tracking (Future Roadmap)
For a true enterprise-grade setup, you should integrate **Sentry**. Sentry will automatically capture React Native crashes and Node.js 500 errors, giving you the exact line of code that failed in production.

---

## 3. Deployment Troubleshooting Guide

### Issue: "Network Error" immediately upon clicking scan
- **Cause**: The React Native app cannot reach the Node.js server.
- **Fix**: Ensure `EXPO_PUBLIC_API_URL` in `eas.json` is exactly correct (must start with `https://` and end with `/api/v1`). You must rebuild the APK (`eas build`) after changing this!

### Issue: "AI Service is offline" (503 Error)
- **Cause**: Node.js cannot reach FastAPI over the internal network.
- **Fix**: Check the `AI_SERVICE_URL` in the Railway backend variables. It must match the internal routing (e.g., `http://ai.railway.internal:8000`).

### Issue: Image uploads but AI returns 33% accuracy on everything
- **Cause**: The double-normalization bug has returned.
- **Fix**: Ensure the production Python environment is running the updated model that does *not* divide pixels by 255 before passing them to the MobileNetV2 `Rescaling` layer.

---

## 4. Rollback Strategy
If a deployment breaks production:
1. Go to the **Deployments** tab in Railway.
2. Find the previously successful deployment.
3. Click the three dots (...) and select **Rollback**.
4. Railway will instantly route traffic back to the stable container while you investigate the broken code locally.
