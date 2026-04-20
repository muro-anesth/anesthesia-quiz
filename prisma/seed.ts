/**
 * prisma/seed.ts
 *
 * 使い方:
 *   npx tsx prisma/seed.ts <quiz_output_dir>
 *
 * 例:
 *   npx tsx prisma/seed.ts ../path/to/output
 *
 * output/ 配下に 2023a/quiz.json, 2023b/quiz.json ... が並んでいる前提。
 * 既存の問題は year+qnum で upsert するため、重複投入しても安全。
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const db = new PrismaClient();

// quiz.json の型
interface QuizQuestion {
  qnum: number;
  stem: string;
  choices: { a: string; b: string; c: string; d: string; e: string };
  answer: string;
  is_image_question: boolean;
  deleted: boolean;
  main_image: string | null;
  option_images: string[];
  notes: string[];
  // PDF直接抽出版
  question_type?: string;
  subitems?: Record<string, string> | null;
}

interface QuizJson {
  year: string;
  questions: QuizQuestion[];
}

// 問題文からカテゴリを簡易推定（後で手動修正可）
function guessCategory(stem: string): string {
  const rules: [RegExp, string][] = [
    [/局所麻酔|脂肪乳剤|LAST|ロカイン|ブピバ|リドカイン/, "薬理・局所麻酔"],
    [/アナフィラキシー|アドレナリン|ヒスタミン/, "薬理・アナフィラキシー"],
    [/筋弛緩|スキサメト|ロクロニウム|スガマデクス|ネオスチグミン/, "薬理・筋弛緩"],
    [/オピオイド|フェンタニル|モルヒネ|レミフェンタニル/, "薬理・オピオイド"],
    [/心肺蘇生|CPR|AED|胸骨圧迫|心停止/, "心肺蘇生"],
    [/心電図|ECG|不整脈|ペースメーカ|除細動/, "モニタリング・ECG"],
    [/血圧|動脈圧|観血的|非観血的|SpO2|カプノ|BIS/, "モニタリング・バイタル"],
    [/気管|挿管|喉頭|マスク|声門|気道/, "気道管理"],
    [/硬膜外|脊髄くも膜下|脊椎|区域麻酔|神経ブロック|PDPH/, "区域麻酔"],
    [/産科|帝王切開|妊娠|分娩|胎児|新生児/, "産科麻酔"],
    [/小児|早産|新生児|乳幼児/, "小児麻酔"],
    [/腹臥位|側臥位|体位|手術台/, "手術体位"],
    [/輸血|赤血球|血小板|FFP|出血/, "輸血・出血管理"],
    [/術後|PACU|せん妄|疼痛|悪心|嘔吐/, "術後管理"],
    [/感染|消毒|滅菌|SSI|予防/, "感染対策"],
    [/電気|電撃|接地|漏電|ペースメーカ|電磁/, "医療機器・安全"],
    [/麻酔器|回路|気化器|蒸発器|ガス|酸素|亜酸化/, "麻酔器・ガス"],
    [/放射線|被曝|防護|シールド/, "放射線安全"],
    [/肝|腎|糖尿|甲状腺|副腎|内分泌/, "合併症・臓器障害"],
    [/脳|頭蓋内圧|脳血流|神経外科/, "脳神経麻酔"],
  ];
  for (const [pattern, category] of rules) {
    if (pattern.test(stem)) return category;
  }
  return "その他";
}

async function seedFromFile(jsonPath: string): Promise<{ upserted: number; skipped: number }> {
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: QuizJson = JSON.parse(raw);
  const { year, questions } = data;

  let upserted = 0;
  let skipped = 0;

  for (const q of questions) {
    if (q.deleted) {
      skipped++;
      continue;
    }

    // X2タイプ判定（問題文に「2つ選べ」「二つ選べ」を含む）
    const isX2 = /2つ選べ|二つ選べ|2つ選ぶ|二つ選ぶ/.test(q.stem);
    const qtype = isX2 ? "x2" : (q.question_type ?? (q.is_image_question ? "image_answers" : "single"));

    await db.question.upsert({
      where: { year_qnum: { year, qnum: q.qnum } },
      create: {
        qnum: q.qnum,
        year,
        category: guessCategory(q.stem),
        stem: q.stem,
        choiceA: q.choices.a,
        choiceB: q.choices.b,
        choiceC: q.choices.c,
        choiceD: q.choices.d,
        choiceE: q.choices.e,
        answer: q.answer,
        questionType: qtype,
        hasImage: q.is_image_question,
        mainImage: q.main_image ?? null,
        optionImages: JSON.stringify(q.option_images ?? []),
        deleted: false,
      },
      update: {
        stem: q.stem,
        choiceA: q.choices.a,
        choiceB: q.choices.b,
        choiceC: q.choices.c,
        choiceD: q.choices.d,
        choiceE: q.choices.e,
        answer: q.answer,
        questionType: qtype,
        hasImage: q.is_image_question,
        mainImage: q.main_image ?? null,
        optionImages: JSON.stringify(q.option_images ?? []),
      },
    });
    upserted++;
  }

  return { upserted, skipped };
}

async function main() {
  const outputDir = process.argv[2];
  if (!outputDir) {
    console.error("使い方: npx tsx prisma/seed.ts <output_dir>");
    console.error("例:     npx tsx prisma/seed.ts ../output");
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    console.error(`ディレクトリが見つかりません: ${outputDir}`);
    process.exit(1);
  }

  const yearDirs = fs
    .readdirSync(outputDir)
    .filter((d) => fs.existsSync(path.join(outputDir, d, "quiz.json")));

  if (yearDirs.length === 0) {
    console.error("quiz.json が見つかりません。extract_images.py を先に実行してください。");
    process.exit(1);
  }

  console.log(`\n${yearDirs.length} 年度分を投入します: ${yearDirs.join(", ")}\n`);

  let totalUpserted = 0;
  let totalSkipped = 0;

  for (const yearDir of yearDirs) {
    const jsonPath = path.join(outputDir, yearDir, "quiz.json");
    const { upserted, skipped } = await seedFromFile(jsonPath);
    console.log(`  ${yearDir}: ${upserted} 問投入, ${skipped} 問スキップ（削除問題）`);
    totalUpserted += upserted;
    totalSkipped += skipped;
  }

  console.log(`\n✓ 完了: 合計 ${totalUpserted} 問投入, ${totalSkipped} 問スキップ\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
