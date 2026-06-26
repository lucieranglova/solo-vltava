export const firebaseConfig = {
  apiKey: "AIzaSyBkmwiEjz3-1mJsqqAMRrqmkU2ZId2ywYw",
  authDomain: "solo-vltava.firebaseapp.com",
  projectId: "solo-vltava",
  storageBucket: "solo-vltava.firebasestorage.app",
  messagingSenderId: "30952605247",
  appId: "1:30952605247:web:0c9ea0fc0d33b58a6ada8a",
  measurementId: "G-5HD00E18K2"
};

// URL Cloud Functions (doplníš po nasazení: firebase deploy --only functions)
export const FUNCTIONS_BASE_URL = "https://us-central1-solo-vltava.cloudfunctions.net";

// Strava OAuth (doplníš po registraci na strava.com/settings/api)
export const STRAVA_CLIENT_ID = "TVŮJ_STRAVA_CLIENT_ID";
export const STRAVA_REDIRECT_URI = window.location.origin + "/?strava_callback=1";
