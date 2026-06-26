import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getDb, getCurrentUid } from './auth.js';

// ---- raceConfig ----
export async function getRaceConfig() {
  const ref = doc(getDb(), 'raceConfig', 'main');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveRaceConfig(data) {
  const ref = doc(getDb(), 'raceConfig', 'main');
  await setDoc(ref, data, { merge: true });
}

// ---- profiles ----
export async function getProfile(profileId) {
  const ref = doc(getDb(), 'profiles', profileId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveProfile(profileId, data) {
  const ref = doc(getDb(), 'profiles', profileId);
  await setDoc(ref, data, { merge: true });
}

export function listenProfile(profileId, callback) {
  const ref = doc(getDb(), 'profiles', profileId);
  return onSnapshot(ref, snap => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// ---- performanceStats ----
export async function getPerformanceStats() {
  const ref = doc(getDb(), 'performanceStats', 'main');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function savePerformanceStats(data) {
  const ref = doc(getDb(), 'performanceStats', 'main');
  await setDoc(ref, {
    ...data,
    lastUpdatedAt: serverTimestamp(),
    lastUpdatedBy: getCurrentUid()
  }, { merge: true });
}

export function listenPerformanceStats(callback) {
  const ref = doc(getDb(), 'performanceStats', 'main');
  return onSnapshot(ref, snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// ---- routeSegments ----
export async function getSegments() {
  const q = query(collection(getDb(), 'routeSegments'), orderBy('orderIndex', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addSegment(data) {
  const segments = await getSegments();
  return addDoc(collection(getDb(), 'routeSegments'), {
    ...data,
    orderIndex: segments.length,
    tried: false,
    createdAt: serverTimestamp()
  });
}

export async function updateSegment(id, data) {
  const ref = doc(getDb(), 'routeSegments', id);
  await updateDoc(ref, data);
}

export async function deleteSegment(id) {
  await deleteDoc(doc(getDb(), 'routeSegments', id));
}

export function listenSegments(callback) {
  const q = query(collection(getDb(), 'routeSegments'), orderBy('orderIndex', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---- scheduleItems ----
export async function getScheduleItems() {
  const q = query(collection(getDb(), 'scheduleItems'), orderBy('startAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addScheduleItem(data) {
  return addDoc(collection(getDb(), 'scheduleItems'), {
    ...data,
    createdAt: serverTimestamp()
  });
}

export async function deleteScheduleItem(id) {
  await deleteDoc(doc(getDb(), 'scheduleItems', id));
}

export function listenScheduleItems(callback) {
  const q = query(collection(getDb(), 'scheduleItems'), orderBy('startAt', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---- checklistCategories ----
export async function getChecklistCategories() {
  const q = query(collection(getDb(), 'checklistCategories'), orderBy('orderIndex', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addChecklistCategory(data) {
  const cats = await getChecklistCategories();
  return addDoc(collection(getDb(), 'checklistCategories'), {
    ...data,
    orderIndex: cats.length,
    createdAt: serverTimestamp()
  });
}

export async function deleteChecklistCategory(id) {
  await deleteDoc(doc(getDb(), 'checklistCategories', id));
}

export function listenChecklistCategories(callback) {
  const q = query(collection(getDb(), 'checklistCategories'), orderBy('orderIndex', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---- checklistItems ----
export async function getChecklistItems(categoryId) {
  const q = query(collection(getDb(), 'checklistItems'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return categoryId ? all.filter(i => i.categoryId === categoryId) : all;
}

export async function addChecklistItem(data) {
  return addDoc(collection(getDb(), 'checklistItems'), {
    ...data,
    checked: false,
    createdAt: serverTimestamp()
  });
}

export async function toggleChecklistItem(id, checked) {
  await updateDoc(doc(getDb(), 'checklistItems', id), { checked });
}

export async function deleteChecklistItem(id) {
  await deleteDoc(doc(getDb(), 'checklistItems', id));
}

export function listenChecklistItems(callback) {
  const q = query(collection(getDb(), 'checklistItems'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---- accommodations ----
export async function getAccommodations() {
  const snap = await getDocs(collection(getDb(), 'accommodations'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addAccommodation(data) {
  return addDoc(collection(getDb(), 'accommodations'), { ...data, createdAt: serverTimestamp() });
}

export async function deleteAccommodation(id) {
  await deleteDoc(doc(getDb(), 'accommodations', id));
}

export function listenAccommodations(callback) {
  return onSnapshot(collection(getDb(), 'accommodations'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---- contacts ----
export async function getContacts() {
  const snap = await getDocs(collection(getDb(), 'contacts'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addContact(data) {
  return addDoc(collection(getDb(), 'contacts'), { ...data, createdAt: serverTimestamp() });
}

export async function deleteContact(id) {
  await deleteDoc(doc(getDb(), 'contacts', id));
}

export function listenContacts(callback) {
  return onSnapshot(collection(getDb(), 'contacts'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---- reservations ----
export async function getReservations() {
  const snap = await getDocs(collection(getDb(), 'reservations'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addReservation(data) {
  return addDoc(collection(getDb(), 'reservations'), { ...data, createdAt: serverTimestamp() });
}

export async function deleteReservation(id) {
  await deleteDoc(doc(getDb(), 'reservations', id));
}

export function listenReservations(callback) {
  return onSnapshot(collection(getDb(), 'reservations'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---- photos ----
export async function addPhotoRecord(data) {
  return addDoc(collection(getDb(), 'photos'), { ...data, takenAt: serverTimestamp(), uploadedBy: getCurrentUid() });
}

export function listenPhotos(callback) {
  const q = query(collection(getDb(), 'photos'), orderBy('takenAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function deletePhoto(id) {
  await deleteDoc(doc(getDb(), 'photos', id));
}

// ---- appSettings ----
export async function getAppSettings(profileId) {
  const ref = doc(getDb(), 'appSettings', profileId || 'default');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : {};
}

export async function saveAppSettings(profileId, data) {
  const ref = doc(getDb(), 'appSettings', profileId || 'default');
  await setDoc(ref, data, { merge: true });
}

// ---- Helper: Timestamp conversion ----
export function tsToDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (ts.toDate) return ts.toDate();
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') return new Date(ts);
  return null;
}

export function formatDate(ts, opts = {}) {
  const d = tsToDate(ts);
  if (!d) return '–';
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', ...opts });
}

export function formatDatetime(ts) {
  const d = tsToDate(ts);
  if (!d) return '–';
  return d.toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
