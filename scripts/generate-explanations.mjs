import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const GEMINI_API_KEY = 'AIzaSyCuC7wLdb82GkuzvGpilrSmJLMlC4DPK04';
const YEARS = ['2023a', '2023b', '2024a', '2024b', '2025a', '2025b'];
const OUTPUT_FILE = 'scripts/explanations-cache.json';
const DELAY_MS = 2000; // API制限対策

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateExplanation(question, year) {
  const choicesText = Object.entries(question.choices)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const subitemsText = question.subitems
    ? '\n小項目:\n' + Object.entries(question.subitems)
        .map(([k, v]) => `(${k}) ${v}`)
        .join('\n')
    : '';

  const prompt = `以下は日本の麻酔科専門医試験の問題です。正答と詳細な解説を提供してください。

問題: ${question.stem}
${subitemsText}

選択肢:
${choicesText}

正答: ${question.answer}

以下の形式で回答してください：
【解説】
正答（${question.answer}）が正しい理由を説明し、各選択肢についても簡潔に解説してください。麻酔科専門医として知っておくべき重要なポイントも含めてください。`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function main() {
  // 既存キャッシュの読み込み
  let cache = {};
  if (existsSync(OUTPUT_FILE)) {
    cache = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`既存キャッシュ: ${Object.keys(cache).length}件`);
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const year of YEARS) {
    const data = JSON.parse(readFileSync(join('quiz-data', year, 'quiz.json'), 'utf-8'));
    const questions = data.questions.filter(q => !q.deleted);

    console.log(`\n=== ${year} (${questions.length}問) ===`);

    for (const q of questions) {
      const key = `${year}-${q.qnum}`;

      // combination型は強制再生成
const isCombination = q.question_type === 'combination';
if (cache[key] && !isCombination) {
  skipped++;
  process.stdout.write('.');
  continue;
}

      try {
        const explanation = await generateExplanation(q);
        cache[key] = explanation;
        generated++;
        process.stdout.write('o');

        // 10問ごとにキャッシュ保存
        if (generated % 10 === 0) {
          writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
          console.log(`\n  [保存] ${generated}問生成済み`);
        }

        await sleep(DELAY_MS);
      } catch (err) {
        errors++;
        console.error(`\nエラー ${key}: ${err.message}`);
        await sleep(5000);
      }
    }
  }

  // 最終保存
  writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
  console.log(`\n\n完了: 生成=${generated}, スキップ=${skipped}, エラー=${errors}`);
  console.log(`合計キャッシュ: ${Object.keys(cache).length}件`);
}

main().catch(console.error);