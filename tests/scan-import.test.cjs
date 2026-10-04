const test=require('node:test');
const assert=require('node:assert/strict');
const sample=()=>({schemaVersion:1,questions:[{year:'2018a',qnum:1,stem:'試験用の設問',category:'気道管理',choices:{a:'一',b:'二',c:'三',d:'四',e:'五'},answer:'d',explanation:'これは本番には登録しない、取り込み手順の検証だけに用いるダミーの解説です。',is_image_question:false,review:{status:'approved',transcription:true,answer:true,explanation:true,images:true,handwriting:true,category:true,openIssues:[],sources:['https://example.org/test-only'],sourceFile:'dummy.jpg'}}]});
test('scan imports reject OCR drafts, pending review and incomplete data',async()=>{
 const {validateScanImport}=await import('../scripts/scan-import-validation.mjs');
 assert.equal(validateScanImport(sample())[0].id,'2018a-1');
 const addedYear=sample();addedYear.questions[0].year='2014b';
 assert.equal(validateScanImport(addedYear)[0].id,'2014b-1');
 for(const mutate of [b=>b.questions[0].review.status='pending',b=>b.questions[0].review.answer=false,b=>b.questions[0].review.openIssues=['unclear'],b=>b.questions[0].answer='f',b=>b.questions[0].answer='aa',b=>delete b.questions[0].choices.e,b=>b.questions.push(b.questions[0]),b=>b.questions[0].year='2025a',b=>{b.questions[0].year='2015a';b.questions[0].qnum=36},b=>b.questions[0].main_image='../secret.png',b=>b.questions[0].review.sources=[]]){
  const b=sample();mutate(b);assert.throws(()=>validateScanImport(b));
 }
});
test('scan import creates only new question documents, never touches user records',async()=>{
 const {validateScanImport,createScanQuestions}=await import('../scripts/scan-import-validation.mjs');
 const rows=validateScanImport(sample()),writes=[],collections=[];
 let collision=false;
 const db={collection:name=>{collections.push(name);return {doc:id=>({id})}},runTransaction:async fn=>fn({getAll:async(...refs)=>refs.map(r=>({...r,exists:collision})),create:(ref,data)=>writes.push({ref,data})})};
 assert.equal(await createScanQuestions(db,rows),1);
 assert.deepEqual(collections,['questions']);
 assert.equal(writes.length,1);
 collision=true;
 await assert.rejects(()=>createScanQuestions(db,rows));
 assert.equal(writes.length,1);
 assert.ok(!JSON.stringify(writes).includes('review'));
});

test('scan categories, diagrams, selection limits and batch limits fail closed',async()=>{
 const {validateScanImport,createScanQuestions}=await import('../scripts/scan-import-validation.mjs');
 const ce=sample();ce.questions[0].category='CE関連';
 assert.equal(validateScanImport(ce)[0].data.category,'CE関連');
 for(const mutate of [q=>q.category='未分類',q=>q.category='架空の分類',q=>q.review.category=false,q=>q.is_image_question=true,q=>q.answer='abc',q=>q.explanation='',q=>q.review.transcription=false]){
  const b=sample();mutate(b.questions[0]);assert.throws(()=>validateScanImport(b));
 }
 await assert.rejects(()=>createScanQuestions({},[]));
 await assert.rejects(()=>createScanQuestions({},Array(401).fill({})));
});
