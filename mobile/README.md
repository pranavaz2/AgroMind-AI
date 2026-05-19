# AgroMind AI Mobile

AgroMind AI is an Expo React Native app that helps farmers detect crop diseases using AI.

## Step 1: Foundation

This step creates the beginner-friendly app foundation only:

- Expo project setup
- JavaScript-only React Native app
- React Navigation setup
- React Native Paper setup
- premium dark green and black theme
- scalable folder structure
- clean initial `App.js`

## Commands Used

Create the Expo project:

```bash
npx create-expo-app@latest . --template blank
```

Install navigation:

```bash
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
```

Install Expo-compatible native dependencies:

```bash
npx expo install react-native-screens react-native-safe-area-context expo-splash-screen @expo/vector-icons
npx expo install expo-location
```

Install React Native Paper:

```bash
npm install react-native-paper react-native-vector-icons
```

Run the app:

```bash
npm start
```

## Folder Structure

```text
src/
  assets/
  components/
  constants/
  context/
  hooks/
  navigation/
  screens/
  services/
  utils/
```

## What Each Folder Does

`screens`
Stores full app screens such as Login, Home, Scan, and Profile.

`navigation`
Keeps navigation logic separate from UI screens. This makes it easier to add auth flow, tabs, and nested stacks later.

`components`
Stores reusable UI pieces. Example: `ScreenContainer` gives every screen a consistent safe-area layout and dark background.

`services`
Stores API calls, AI scan requests, authentication requests, upload logic, and weather requests.

`hooks`
Will store reusable React logic, such as `useAuth`, `useCameraPermission`, `useDiseaseScan`, or weather/location helpers.

`constants`
Stores values that should not be scattered across files, such as theme colors and route names.

`utils`
Stores small helper functions that do not belong to one specific screen.

`assets`
Stores images, icons, fonts, and app media used by features. Expo app icons remain in the root `assets` folder.

`context`
Stores app-wide providers and shared state. Example: `AppProviders` wraps the app with React Native Paper.

## Why This Architecture Is Used

This structure keeps each responsibility in one place:

- screens display UI
- navigation controls movement between screens
- services talk to the backend
- constants prevent typo-prone repeated values
- components keep UI reusable
- context manages app-wide providers/state

That separation is easier for beginners because each folder has a clear job. It also scales well when AgroMind AI later adds authentication, camera scanning, AI disease results, farmer profile settings, and offline history.

## Scaling Best Practices

- Keep screens focused on layout and user interaction.
- Move API/backend calls into `services`.
- Reuse shared UI through `components`.
- Store route names in `constants/routes.js` instead of typing strings everywhere.
- Store colors and spacing in `constants/theme.js` so the UI stays consistent.
- Add comments only where code teaches an important idea.
- Prefer functional components for every screen and component.

## Theme System

The theme is split into focused files:

```text
src/constants/colors.js
src/constants/typography.js
src/constants/spacing.js
src/constants/theme.js
```

Use `theme` from `constants/theme.js` inside screens and components. Add new color, spacing, radius, and font tokens to the focused files instead of hardcoding repeated values in screens.

## Reusable Components

Shared UI components live in `src/components`:

```text
CustomButton.js
CustomInput.js
CustomCard.js
ScreenHeader.js
LoadingSpinner.js
```

These components keep repeated UI patterns in one place. Screens should pass data through props, such as `title`, `value`, `onPress`, or `error`, instead of rewriting the same button, input, card, and header styling again.

## Navigation System

The app uses three navigation files:

`AppNavigator.js`
This is the root navigator. It owns `NavigationContainer`, starts with `SplashScreen`, then moves into the auth flow or main app flow.

`AuthNavigator.js`
This is a stack navigator for authentication screens. Login and Signup belong here because users move forward and backward through auth screens.

`BottomTabNavigator.js`
This is the main app navigator. Home, Scan, and Profile stay in bottom tabs because farmers will use these screens often.

## Screen Flow

```text
SplashScreen
  -> AuthNavigator
      -> LoginScreen
      -> SignupScreen
  -> BottomTabNavigator
      -> HomeScreen
      -> ScanScreen
      -> ProfileScreen
  -> ResultScreen
```

`ResultScreen` is in the root stack instead of the bottom tabs because it is a temporary detail screen after scanning, not a main destination.

## Frontend AI Scan Flow

The Scan tab connects the React Native app to the real TensorFlow backend
through the Node API. The mobile app never talks directly to FastAPI; it sends
the image to Node so authentication, scan history, Cloudinary upload, and
notifications stay centralized.

```text
ScanScreen
  -> Expo ImagePicker camera/gallery asset
  -> scanService.analyzeCrop(asset)
  -> Axios multipart POST /api/v1/scans
  -> Node backend validates auth and image upload
  -> Node forwards image to Python FastAPI
  -> TensorFlow model returns disease prediction
  -> Node stores scan in PostgreSQL
  -> ResultScreen renders prediction, severity, treatment, and model confidence
```

The upload field is named `image`, matching the Node backend Multer middleware.
`scanService.js` builds `FormData` from the ImagePicker asset, preserving the
local URI, filename, and MIME type when Expo provides them.

## Async Handling

`ScanScreen` keeps separate state for image selection and prediction:

- `isPickingImage`: disables camera/gallery actions while Expo is opening a picker.
- `isAnalyzing`: disables scan actions while the request is in flight.
- `errorMessage`: renders permission, network, timeout, and backend validation errors.
- `activeStep`: advances the premium loading panel while TensorFlow work is pending.

The Axios client converts server, timeout, and network failures into displayable
JavaScript errors. The scan request uses a longer timeout because mobile image
upload plus TensorFlow inference can take longer than normal JSON API calls.

## Loading UX

During prediction, the app shows a step-based progress panel:

```text
Uploading leaf image
Forwarding to TensorFlow model
Reading disease signals
Preparing treatment plan
```

This keeps the farmer oriented while the request moves through mobile upload,
Node backend orchestration, Python inference, and response rendering. The result
screen also shows whether the response came from the TensorFlow model, the local
TensorFlow demo fallback, or another AI fallback.

## AI Confidence Visualization

`ConfidenceVisualization.js` turns model output into a farmer-friendly trust
display. It shows:

- The top prediction confidence as a percentage.
- A main certainty bar for the selected diagnosis.
- Ranked class probability bars from TensorFlow `top_predictions`.
- Severity and risk indicators using success, warning, and danger colors.
- A source badge so users know whether the result came from TensorFlow or a fallback.

AI confidence is a probability score, not a guarantee. A `91%` score means the
model assigned high probability to that class compared with other known disease
classes. The UX groups confidence into trust bands:

- `85%+`: high model agreement.
- `65-84%`: moderate agreement; inspect the field before treatment.
- Below `65%`: low agreement; retake the image or ask an agronomist.

This improves user trust by showing uncertainty honestly instead of presenting
AI output as absolute truth. Farmers can see both the best prediction and the
nearest alternatives before acting on treatment guidance.

## Weather Data Flow

The home screen uses `src/services/locationService.js` as the single location layer. That service handles Expo Location permissions, GPS detection, manual place search, reverse geocoding, and SecureStore persistence.

Location flow:

```text
HomeScreen
  -> locationService.getStoredLocation()
  -> if missing: locationService.saveCurrentLocation()
  -> weatherService.getCurrentWeather({ latitude, longitude })
  -> backend OpenWeather route
```

Weather call:

```text
GET /api/v1/weather/current?lat=<latitude>&lon=<longitude>
```

The backend keeps the OpenWeather API key private, calls OpenWeather, and returns a clean weather object with live temperature, humidity, rain, wind, alerts, and farming suggestions. The home screen renders this as a premium weather card with loading, permission, error, rain-alert, heat-warning, location source, and suggestion states.

Manual location:

```text
User enters a village/city/district
  -> Expo Location geocodes it to coordinates
  -> app stores the saved farm location in SecureStore
  -> weather and farming insights use that stored location
```

Privacy:

- Precise latitude and longitude are stored locally on the device with SecureStore.
- AgroMind sends coordinates to the backend only when weather data is requested.
- The OpenWeather API key never ships in the mobile app.
- Users can avoid GPS by saving a manual location.

## AI Voice Assistant Flow

The Assistant tab uses Expo APIs for a farmer-friendly voice loop:

```text
Farmer taps mic
  -> Expo AV asks for microphone permission
  -> app records audio locally
  -> mobile uploads audio to /api/v1/voice/ask
  -> backend sends audio to Gemini for speech-to-text
  -> backend asks Gemini for a simple farming answer
  -> mobile shows transcript + answer
  -> Expo Speech reads the answer aloud
```

Typed fallback:

```text
Farmer types a question
  -> /api/v1/voice/text
  -> AI answer
  -> optional text-to-speech playback
```

Malayalam support architecture:

- The backend asks AI to detect the spoken language.
- If Malayalam is detected, the answer is requested in Malayalam.
- The mobile screen includes an English/Malayalam mode for typed questions.
- Text-to-speech uses language hints such as `ml-IN` and `en-IN` when speaking.

Voice UX best practices used here:

- One large microphone action.
- Clear listening/thinking/speaking states.
- Typed fallback when recording is not possible.
- Short spoken answers suitable for field use.
- Transcript shown so users can confirm what the AI heard.
