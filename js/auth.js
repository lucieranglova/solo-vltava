import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

let app, auth, db, storage;
let _uid = null;

export function getApp() { return app; }
export function getDb() { return db; }
export function getAuthInstance() { return auth; }
export function getStorageInstance() { return storage; }
export function getCurrentUid() { return _uid; }

export async function initFirebase() {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  storage = getStorage(app);
  db = getFirestore(app);

  // Enable offline persistence (pro offline checklist na Den D)
  try {
    await enableIndexedDbPersistence(db);
  } catch (err) {
    if (err.code === 'failed-precondition') {
      console.warn('Offline persistence: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Offline persistence: not supported in this browser');
    }
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      unsubscribe();
      if (user) {
        _uid = user.uid;
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          _uid = cred.user.uid;
          resolve(cred.user);
        } catch (err) {
          console.error('Anonymous sign-in failed:', err);
          reject(err);
        }
      }
    });
  });
}
