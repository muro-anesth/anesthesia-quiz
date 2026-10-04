import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const categories = JSON.parse(readFileSync(new URL('../src/lib/questionCategories.json', import.meta.url)));

const allowedYears = new Set(['2015a','2015b','2016a','2016b','2017a','2017b','2018a','2018b','2022a','2022b']);
const requiredChecks = ['transcription','answer','explanation','images','handwriting','category'];

// Fail closed: staging OCR must never become a live question by accident.
export function validateScanImport(bundle) {
  assert.equal(bundle.schemaVersion, 1, 'Unsupported scan bundle');
  assert.ok(Array.isArray(bundle.questions) && bundle.questions.length > 0, 'No questions');
  assert.ok(bundle.questions.length <= 594, 'Unexpected question count');
  const ids = new Set();
  return bundle.questions.map(q => {
    assert.ok(allowedYears.has(q.year), `Out-of-scope year: ${q.year}`);
    assert.ok(Number.isInteger(q.qnum) && q.qnum >= 1 && q.qnum <= 60, 'Invalid question number');
    assert.ok(!(q.year === '2015a' && q.qnum >= 36 && q.qnum <= 41), 'Missing source page cannot be imported');
    const id = `${q.year}-${q.qnum}`;
    assert.ok(!ids.has(id), `Duplicate: ${id}`);
    ids.add(id);
    assert.equal(q.review?.status, 'approved', `${id}: not reviewed`);
    for (const key of requiredChecks) assert.equal(q.review[key], true, `${id}: ${key} not checked`);
    assert.deepEqual(q.review.openIssues, [], `${id}: unresolved issues`);
    assert.ok(typeof q.stem === 'string' && q.stem.trim(), `${id}: empty stem`);
    assert.ok(categories.includes(q.category) && q.category !== '未分類', `${id}: category required`);
    assert.deepEqual(Object.keys(q.choices).sort(), ['a','b','c','d','e'], `${id}: choices incomplete`);
    assert.ok(Object.values(q.choices).every(x=>typeof x === 'string' && x.trim()), `${id}: empty choice`);
    assert.ok(/^[a-e]{1,2}$/.test(q.answer) && new Set(q.answer).size===q.answer.length, `${id}: answer invalid or unsupported selection count`);
    assert.ok(typeof q.explanation === 'string' && q.explanation.trim().length >= 30, `${id}: explanation absent`);
    assert.ok(Array.isArray(q.review.sources) && q.review.sources.length>0 && q.review.sources.every(x=>typeof x==='string' && /^https:\/\//.test(x)), `${id}: sources absent`);
    assert.ok(typeof q.review.sourceFile==='string' && q.review.sourceFile, `${id}: original source absent`);
    assert.equal(typeof q.is_image_question,'boolean',`${id}: image flag absent`);
    const images=[q.main_image,...(q.option_images??[])].filter(Boolean);
    assert.ok(images.every(x=>typeof x==='string' && /^[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(x)), `${id}: unsafe image path`);
    assert.ok(!q.is_image_question || images.length>0, `${id}: missing image`);
    return {id, data:{year:q.year,qnum:q.qnum,stem:q.stem,choices:q.choices,answer:q.answer,
      explanation:q.explanation,is_image_question:q.is_image_question,main_image:q.main_image??null,
      option_images:q.option_images??[],category:q.category??'未分類'}};
  });
}

export async function createScanQuestions(db, validated) {
  assert.ok(validated.length>0 && validated.length<=400, 'Use reviewed batches of at most 400 questions');
  // One transaction: an existing document aborts the entire operation. Never
  // merge/set/delete questions and never reference users, attempts or progress.
  return db.runTransaction(async tx=>{
    const refs=validated.map(q=>db.collection('questions').doc(q.id));
    const snapshots=await tx.getAll(...refs);
    const collisions=snapshots.filter(s=>s.exists).map(s=>s.id);
    assert.deepEqual(collisions,[],`Already exists: ${collisions.join(', ')}`);
    validated.forEach((q,i)=>tx.create(refs[i],q.data));
    return validated.length;
  });
}
