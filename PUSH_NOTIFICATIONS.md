# Push notifications (mobile & tablet)

The app registers the device FCM token with `POST /api/notifications/tokens`
(`src/store/services/pushService.js`). The backend then sends FCM messages for
persisted `AppNotification` rows (alerts + maintenance assignments), so they
arrive even when the app is closed.

Remote push **cannot work in Expo Go** (Expo removed it in SDK 53). It requires
a development build / production build.

## Android setup

1. Create a Firebase Android app with package name `com.smartfactory` (or the
   package configured in `app.json`).
2. Download `google-services.json` and place it at `frontend/google-services.json`.
3. Add it to `app.json` under `expo.android`:

   ```json
   "android": {
     "googleServicesFile": "./google-services.json",
     "package": "com.smartfactory"
   }
   ```

   (The `expo-notifications` plugin is already registered in `plugins`.)
4. Rebuild the native app:

   ```powershell
   npx expo prebuild --clean
   npx expo run:android
   ```

## iOS setup

1. Create a Firebase iOS app with the bundle identifier used in `app.json`.
2. Add `GoogleService-Info.plist` and set `expo.ios.googleServicesFile`.
3. Enable the Push Notifications capability and upload the APNs key in Firebase.
4. Rebuild: `npx expo prebuild --clean` then `npx expo run:ios`.

## Backend

- `app.firebase.enabled=true` and a Firebase service-account credential must be
  configured in the Spring Boot service. Without it the backend only logs the
  push (simulation mode).
- The token row must be `ANDROID` / `IOS` (the app sends this automatically).

## Behaviour implemented in the frontend

- Android notification channel `default` created at startup (required on
  Android 8+, otherwise while-closed pushes can be dropped silently).
- Permission request (Android 13+ included).
- Raw FCM token preferred; Expo push token used only as a fallback.
- Token re-registered when FCM rotates it (`addPushTokenListener`).
- Tapping a notification marks the matching row read and opens the alert,
  intervention or machine it belongs to.
- In-app live updates: `/topic/users/{userId}/notifications` (rows) and
  `/topic/users/{userId}/unread-count` (bell badge), so an assignment reaches
  the technician immediately while the app is open.
