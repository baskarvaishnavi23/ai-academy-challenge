import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { JournalEntry } from '../types';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore targeting provisioned database ID
export const db: Firestore = firebaseConfigData.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(app);

/**
 * Strict Undefined-Stripping Utility
 * Mandated by Production Directives to prevent Firestore runtime write exceptions.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

/**
 * Sign Out
 */
export async function logOut(): Promise<void> {
  await fbSignOut(auth);
}

/**
 * Real-time subscription to user-isolated journal entries
 * Collection path: /users/{userId}/entries
 */
export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled Reflection',
          snippet: data.snippet || '',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          sentiment: data.sentiment || 'Reflective',
          tags: Array.isArray(data.tags) ? data.tags : ['Journal'],
          isStarred: !!data.isStarred,
          turns: Array.isArray(data.turns) ? data.turns : [],
          summary: data.summary || '',
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Error listening to user entries:', err);
      onError(err);
    }
  );
}

/**
 * Save or Update a user's isolated journal entry
 */
export async function saveJournalEntry(userId: string, entry: JournalEntry): Promise<void> {
  if (!userId) throw new Error('Cannot save entry without authenticated user ID.');
  const entryDocRef = doc(db, 'users', userId, 'entries', entry.id);
  const sanitizedPayload = stripUndefined({
    ...entry,
    userId,
    updatedAt: Date.now(),
  });
  await setDoc(entryDocRef, sanitizedPayload, { merge: true });
}

/**
 * Delete a user's isolated journal entry
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) return;
  const entryDocRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryDocRef);
}

export { onAuthStateChanged };
