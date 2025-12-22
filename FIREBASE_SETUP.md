# Firebase & Cloud SQL Setup Guide

This project is configured to be deployed as a **Firebase Cloud Function** (2nd Gen) which hosts the Express backend, connected to a **Google Cloud SQL (PostgreSQL)** database.

## 1. Prerequisites
1.  **Firebase CLI**: Install with `npm install -g firebase-tools`.
2.  **Login**: Run `firebase login`.
3.  **Project**: Ensure you have a Firebase project created.

## 2. Connect to Your Firebase Project
In the root directory, run:
```bash
firebase use --add
```
Select your existing Firebase project. This creates a `.firebaserc` file.

## 3. Database Setup (Google Cloud SQL)
Since Firebase doesn't host Postgres natively, we use **Cloud SQL**.

1.  **Enable APIs**: Go to Google Cloud Console > APIs & Services > Library. Enable:
    *   **Cloud SQL Admin API**
    *   **Cloud Functions API**
    *   **Artifact Registry API** (for building functions)
    *   **Secret Manager API** (optional but recommended for keys)

2.  **Create Instance**:
    *   Go to **Cloud SQL** > **Create Instance** > **PostgreSQL**.
    *   Choose an ID (e.g., `thedump-db`).
    *   Set a password for the `postgres` user.
    *   (Cost Saving) Choose "Enterprise Plus" or "Standard" but select **Sandbox** or minimal CPU/RAM (e.g. Shared Core) for dev.

3.  **Create Database**:
    *   Inside the instance, go to **Databases** > **Create Database**. Name it `thedump`.

4.  **Get Connection Name**:
    *   Note the **Connection Name** (e.g., `project-id:region:instance-id`) from the Overview page.

## 4. Environment Configuration
We need to give the Cloud Function access to the database password and Gemini API key.

1.  **Set Secrets** (Recommended):
    ```bash
    firebase functions:secrets:set GEMINI_API_KEY
    # Enter your Gemini Key
    
    firebase functions:secrets:set DB_PASSWORD
    # Enter your DB Password
    ```

2.  **Update `backend/src/config.ts` (or similar)**:
    Ensure your DB connection uses the socket path for Cloud SQL when running in production.
    
    *Typically, the `DATABASE_URL` format for Cloud SQL is:*
    `postgres://postgres:PASSWORD@/thedump?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_ID`

## 5. Deploying the Backend
To deploy the backend to Firebase Cloud Functions:

1.  Navigate to root:
    ```bash
    firebase deploy --only functions
    ```
    
    *Note: If you use Secrets, you need to grant the function access to them in `firebase-functions` config, or easier, use environment variables via `firebase functions:config:set`.*

## 6. Frontend Configuration
1.  **Get API URL**: After deployment, Firebase will output the Function URL (e.g., `https://us-central1-project.cloudfunctions.net/api`).
2.  **Update Frontend**: Replace `http://localhost:3000` in `frontend/src/screens/*.tsx` with your new production URL.

## 7. App Hosting (Optional)
If you specifically wanted **Firebase App Hosting** (the new product):
*   It currently supports Next.js and Angular.
*   Since this is a custom Node backend + Mobile App, **Cloud Functions** (as set up above) is the correct architectural choice on Firebase.
*   For the **React Native App**, you build the `.apk` / `.ipa` and distribute via **Firebase App Distribution** or the App Stores.

## 8. GitHub Integration
To auto-deploy on push:
1.  Run `firebase init hosting:github` (even though we are using functions, this sets up the Action).
2.  Or manually create a `.github/workflows/deploy.yml` that runs `firebase deploy --only functions`.

