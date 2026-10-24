import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

function requireOwner(uid: string) {
  if (!uid || auth.currentUser?.uid !== uid) throw new Error('ログインし直してください。');
}

export async function getQuestionStars(uid: string): Promise<string[]> {
  requireOwner(uid);
  const snap = await getDocs(collection(db, 'users', uid, 'questionStars'));
  return snap.docs.filter(d => d.data().starred === true).map(d => d.id);
}

export async function setQuestionStar(uid: string, questionId: string, starred: boolean) {
  requireOwner(uid);
  if (!questionId || questionId.length > 200 || questionId.includes('/')) throw new Error('問題IDが不正です。');
  // Independent preferences: never modify questions, attempts, progress or exam results.
  // Unstar is reversible metadata, not deletion of the stored record.
  await setDoc(doc(db, 'users', uid, 'questionStars', questionId), {
    questionId, starred, updatedAt: serverTimestamp(),
  });
}
