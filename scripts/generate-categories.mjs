import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('scripts/serviceAccountKey.json'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// APIキーはソースに書かない。`.env.local`（gitignore 済み）に置いて渡す:
//   export $(grep GEMINI_API_KEY .env.local | xargs) && node scripts/generate-categories.mjs
// ⚠️ 以前は直書きされており、**コミット 2be3b64 の履歴に残っている**。
//    このリポジトリを公開する場合は、先に履歴からの除去かキーの失効が要る。
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY が未設定です。.env.local を読み込んでから実行してください。');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

const CATEGORIES = [
  '薬理・局所麻酔', '薬理・アナフィラキシー', '薬理・筋弛緩', '薬理・オピオイド',
  '心肺蘇生', 'モニタリング・ECG', 'モニタリング・バイタル', '気道管理',
  '区域麻酔', '産科麻酔', '小児麻酔', '輸血・出血管理', '術後管理', '未分類',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function categorize(stem) {
  const prompt = `以下は麻酔科専門医試験の問題文です。最も適切なカテゴリーを1つだけ選んで、カテゴリー名のみ回答してください。

カテゴリー一覧:
${CATEGORIES.join('\n')}

問題文: ${stem.slice(0, 200)}

カテゴリー名のみ回答:`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  return CATEGORIES.includes(text) ? text : '未分類';
}

async function main() {
  // categoryフィールドがない、またはnull/未分類の問題を全件取得して対象を絞る
  const snapshot = await db.collection('questions').get();
  const docs = snapshot.docs.filter(d => {
    const cat = d.data().category;
    return !cat || cat === '未分類';
  });
  console.log(`カテゴリー未設定: ${docs.length}件`);

  let done = 0;
  let errors = 0;

  for (const doc of docs) {
    const data = doc.data();
    try {
      const category = await categorize(data.stem);
if (category === '未分類') {
  process.stdout.write('?');
  done++;
  await sleep(1500);
  continue;
}
await doc.ref.update({ category });
      process.stdout.write('o');
      done++;
      if (done % 20 === 0) console.log(`\n  [進捗] ${done}/${docs.length}件`);
      await sleep(1500);
    } catch (err) {
      errors++;
      console.error(`\nエラー ${doc.id}: ${err.message}`);
      await sleep(3000);
    }
  }

  console.log(`\n\n完了: ${done}件処理, エラー${errors}件`);
}

main().catch(console.error);