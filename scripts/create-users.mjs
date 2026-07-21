import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('scripts/serviceAccountKey.json'));
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

const DOMAIN = 'periop-quiz.app';

const users = [
  { username: 'muro',   password: 'kameda',   role: 'admin' },
  { username: 'Chiemi', password: 'Kameda', role: 'user'  },
  { username: 'test',   password: 'Kameda',   role: 'user'  },
];

async function main() {
  for (const u of users) {
    const email = `${u.username}@${DOMAIN}`;

    try {
      // Firebase Authにユーザー作成
      const userRecord = await auth.createUser({
        email,
        password: u.password,
        displayName: u.username,
      });

      // Firestoreにロール情報を保存
      await db.collection('users').doc(userRecord.uid).set({
        username: u.username,
        email,
        role: u.role,
        createdAt: new Date(),
      });

      console.log(`✅ ${u.username} (${u.role}) 作成完了 uid: ${userRecord.uid}`);
    } catch (err) {
      console.error(`❌ ${u.username}: ${err.message}`);
    }
  }
}

main().catch(console.error);