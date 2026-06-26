import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBkmwiEjz3-1mJsqqAMRrqmkU2ZId2ywYw",
  authDomain: "solo-vltava.firebaseapp.com",
  projectId: "solo-vltava",
  storageBucket: "solo-vltava.firebasestorage.app",
  messagingSenderId: "30952605247",
  appId: "1:30952605247:web:0c9ea0fc0d33b58a6ada8a"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export function ensureAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) resolve(user);
      else signInAnonymously(auth).catch(reject);
    });
  });
}
