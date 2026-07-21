import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// サービスアカウントキーのパス（次のステップで作成）
const serviceAccount = JSON.parse(readFileSync('scripts/serviceAccountKey.json'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const YEARS = ['2023a', '2023b', '2024a', '2024b', '2025a', '2025b'];
const cache = JSON.parse(readFileSync('scripts/explanations-cache.json'));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  let total = 0;
  let errors = 0;

  for (const year of YEARS) {
    const data = JSON.parse(readFileSync(`quiz-data/${year}/quiz.json`));
    const questions = data.questions.filter(q => !q.deleted);

    console.log(`\n=== ${year} (${questions.length}問) ===`);

    // バッチ書き込み（500件上限）
    let batch = db.batch();
    let batchCount = 0;

    for (const q of questions) {
      const key = `${year}-${q.qnum}`;
      const docId = key;
      const ref = db.collection('questions').doc(docId);

      batch.set(ref, {
        year,
        qnum: q.qnum,
        stem: q.stem,
        choices: q.choices,
        answer: q.answer,
        is_image_question: q.is_image_question ?? false,
        main_image: q.main_image ?? null,
        option_images: q.option_images ?? [],
        explanation: cache[key] ?? null,
        createdAt: new Date(),
      }, { merge: true });

      batchCount++;
      total++;

      // 500件ごとにコミット
      if (batchCount === 499) {
        await batch.commit();
        console.log(`  [コミット] ${total}件`);
        batch = db.batch();
        batchCount = 0;
        await sleep(1000);
      }
    }

    // 残りをコミット
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  [コミット] ${total}件`);
    }
  }

  console.log(`\n完了: 合計${total}件, エラー${errors}件`);
}

main().catch(console.error);