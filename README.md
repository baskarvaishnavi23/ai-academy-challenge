# Gemini Journal & Reflections

A secure, full-stack, user-authenticated journaling and personal reflection web application powered by **Firebase Authentication**, **Cloud Firestore**, and the **Gemini 3.6 Flash API** with automatic model fallback resilience.

---

## Architecture & Security Highlights

1. **User Identity & Federated Auth**: Secure authentication powered by Firebase Auth with Google Sign-In (`GoogleAuthProvider`). No passwords or plaintext emails are stored in application code.
2. **Strict User Data Isolation**: Cloud Firestore security rules isolate every journal entry, prompt, and reflection to `/users/{userId}/entries/{entryId}`. No user can read or write any other user's reflections.
3. **Server-Side AI Model Fallback Ladder**: The Gemini API key remains isolated exclusively on the server runtime. API calls are managed through a resilient multi-model fallback ladder:
   - Primary: `gemini-3.6-flash`
   - High-Availability Fallback: `gemini-3.1-flash-lite`
   - Dynamic Alias: `gemini-flash-latest`
   - Deep Reasoning Fallback: `gemini-3.7-flash`
4. **Guaranteed Transaction Verification & Payload Hygiene**: Client-side undefined-stripping ensures zero Firestore payload write crashes, with visual error banners and retry-save capabilities if network interruptions occur.

---

## 1. Prerequisites & Environment Setup

Ensure you have the following CLI tools installed:
- [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install)
- [Firebase CLI (`firebase`)](https://firebase.google.com/docs/cli)
- [Node.js (v20+) and npm](https://nodejs.org)

### Enable Required Google Cloud APIs

```bash
# Set your active GCP project ID
export PROJECT_ID="YOUR_PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable Cloud Run, Secret Manager, and Cloud Firestore APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 2. Cloud Firestore Configuration & Security Rules

Create and deploy the owner-bound security rules to ensure strict isolation of user documents:

### `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profile document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Isolated user journal reflections & entries
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Isolated interactions & chat turns
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Deny all other unmatched paths
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy the rules via Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

---

## 3. Secret Management Setup

Store your Gemini API key securely in **Google Cloud Secret Manager** and grant Cloud Run's service account permission to access it:

```bash
# 1. Create and populate the GEMINI_API_KEY secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Retrieve your Google Cloud project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# 3. Grant the default Cloud Run runtime service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Local Development

```bash
# Install project dependencies
npm install

# Start development full-stack server (Express + Vite on port 3000)
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 5. Cloud Run Deployment

Deploy the containerized full-stack application directly to Google Cloud Run:

```bash
# Deploy to Cloud Run mounting the Secret Manager secret
gcloud run deploy gemini-journal-reflections \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

---

## 6. Required Campaign Verification Binding

Apply the mandatory challenge verification label to register the Cloud Run service:

```bash
gcloud run services update gemini-journal-reflections \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 7. Functional Stability Walkthrough & Test Guide

Every user interaction has a corresponding verification scenario:

| Feature Area | User Action | Expected Observable Outcome |
| :--- | :--- | :--- |
| **Authentication Flow** | Click **"Continue with Google"** on landing page. | Firebase popup opens; upon approval, user enters private dashboard showing their avatar and email in the header. |
| **Session Isolation** | Sign in as User A, write a journal entry; log out and sign in as User B. | User B sees an empty reflection list; none of User A's entries are accessible or visible. |
| **Multi-Turn Reflection** | Write a thought, choose **"Deep Reflection"**, press Enter. | Input shows as User thought; Gemini responds with empathetic inquiry; prompt input remains active for follow-up turns. |
| **Summarization & Insights** | Select **"Summary & Insights"** mode and send another prompt in the same entry. | Gemini analyzes the conversation history and outputs key themes and takeaways. |
| **Firestore Persistence** | Refresh the browser page or revisit after closing. | Past reflection appears in the left sidebar with timestamp, sentiment tag, and full multi-turn dialog intact. |
| **Auto-Title Generation** | Click the **"Auto-title"** sparkle button on an active entry. | Gemini analyzes the reflection text and updates the title input with a concise, evocative title. |
| **Starring & Filtering** | Click the Star icon on an entry; toggle the Star filter button in the sidebar. | Only starred entries display in the sidebar list; status persists across reloads. |
| **Safe Deletion** | Click the trash icon on an entry and confirm the prompt. | The document is removed from Firestore and immediately leaves the sidebar list. |
| **Persistence Error Guard** | Simulate offline network and submit an entry. | An error banner appears with a **"Retry Save"** action; the user's input is preserved in the textarea without data loss. |
