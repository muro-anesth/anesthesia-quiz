import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('scripts/serviceAccountKey.json'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const YEARS = ['2023a', '2023b', '2024a', '2024b', '2025a', '2025b'];

async function main() {
  let updated = 0;
  for (const year of YEARS) {
    const data = JSON.parse(readFileSync(`quiz-data/${year}/quiz.json`));
    const questions = data.questions.filter(q => !q.deleted);
    for (const q of questions) {
      const key = `${year}-${q.qnum}`;
      const updateData = {
        question_type: q.question_type ?? 'single',
        subitems: q.subitems ?? null,
      };
      await db.collection('questions').doc(key).update(updateData);
      updated++;
      if (updated % 50 === 0) console.log(`${updated}件更新済み`);
    }
  }
  console.log(`完了: ${updated}件`);
}

main().catch(console.error);