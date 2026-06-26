// ============================================================
//  FIREBASE CONFIGURATION
//  Vyplň tuto konfiguraci z Firebase Console:
//  https://console.firebase.google.com → Projekt → Nastavení projektu → Webová aplikace
// ============================================================

export const firebaseConfig = {
  apiKey: "TVŮJ_API_KEY",
  authDomain: "TVŮJ_PROJECT_ID.firebaseapp.com",
  projectId: "TVŮJ_PROJECT_ID",
  storageBucket: "TVŮJ_PROJECT_ID.appspot.com",
  messagingSenderId: "TVŮJ_MESSAGING_SENDER_ID",
  appId: "TVŮJ_APP_ID"
};

// URL Cloud Functions (po nasazení)
// Formát: https://<region>-<project-id>.cloudfunctions.net
export const FUNCTIONS_BASE_URL = "https://us-central1-TVŮJ_PROJECT_ID.cloudfunctions.net";

// Strava OAuth
export const STRAVA_CLIENT_ID = "TVŮJ_STRAVA_CLIENT_ID";
// redirect_uri musí odpovídat tomu, co máš zaregistrované v Strava API settings
export const STRAVA_REDIRECT_URI = window.location.origin + "/?strava_callback=1";
