import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "periop-quiz",
  appId: "1:141893167298:web:5dfbbde81c89704079735b",
  storageBucket: "periop-quiz.firebasestorage.app",
  apiKey: "AIzaSyCasvL94gwhzG76Yeo_EnzlEpf6o2VyD24",
  authDomain: "periop-quiz.firebaseapp.com",
  messagingSenderId: "141893167298",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;