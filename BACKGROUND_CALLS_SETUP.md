# Background Call "Ringing" Setup

Since you already use FCM, you just need to ensure the **High-Priority** configuration is active for video calls to "ring" while the app is closed.

## 1. Socket Server Setup (Crucial)
The server needs permission to send "High Priority" messages to your users' devices.

1.  **Firebase Service Account**:
    *   In Firebase Console, go to **Project Settings > Service Accounts**.
    *   Click **Generate new private key**.
    *   Rename it to `firebase-service-account.json`.
    *   Place it in your `socket-server/` folder on your server.
    *   *Note: If you use Render/Railway, you can also convert this file to Base64 and add it as an Environment Variable `FIREBASE_SERVICE_ACCOUNT`.*

## 2. GitHub Secrets (CI/CD)
Ensure your GitHub Actions can still build the app with your FCM config:
*   **`GOOGLE_SERVICES_JSON`**: Add your `google-services.json` content as a Base64 secret if it's not already in your repo.
*   **`FIREBASE_SERVICE_ACCOUNT`**: (Optional for build, but required for the socket server to send pushes).

## 3. What this enables:
*   **Wake Up**: High-priority pushes bypass Android's "Doze" mode.
*   **Ringing UI**: When a call comes in and the app is closed, a heads-up notification with "Accept" and "Decline" buttons will appear.
*   **Sound/Vibration**: Uses the max-importance `incoming_calls` channel I've added to the code.

## 4. Pro Tip for "Real" Ringing
To make it ring continuously like a real phone (instead of a single notification beep):
1. Add an `.mp3` file named `ringtone.mp3` to `android/app/src/main/res/raw/`.
2. The code is already configured to look for a custom sound if you add it.
