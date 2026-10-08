const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rows=[{id:'q1',data:{year:'2023a',answer:'B'}},{id:'old',data:{year:'2014a'}}];
const valid=[{id:'q1',explanation:'正答：B。'+ '確認済みの理由を記載する。'.repeat(8)}];
test('explanation release validates full scope and rejects field mutations',async()=>{
 const {validateExplanations}=await import('../scripts/explanation-validation.mjs');
 assert.equal(validateExplanations(rows,valid,['2023a']).size,1);
 for(const bad of [[],[...valid,...valid],[{...valid[0],answer:'C'}],[{...valid[0],id:'old'}],[{...valid[0],explanation:valid[0].explanation.replace('B','C')}],[{...valid[0],explanation:'短い'}],[{...valid[0],explanation:'x'.repeat(951)}],[{...valid[0],explanation:'**正答**'+valid[0].explanation}]]){
  assert.throws(()=>validateExplanations(rows,bad,['2023a']));
 }
 assert.equal(rows[0].data.answer,'B');
});
test('2023–2025 concise explanations cover all fixed answer keys and combinations',async()=>{
 const {validateExplanations}=await import('../scripts/explanation-validation.mjs');
 const root=path.resolve(__dirname,'..');
 const cache=JSON.parse(fs.readFileSync(path.join(root,'scripts/explanations-cache.json')));
 const years=['2023a','2023b','2024a','2024b','2025a','2025b'];
 const before=years.flatMap(year=>JSON.parse(fs.readFileSync(path.join(root,'quiz-data',year,'quiz.json'))).questions.filter(q=>!q.deleted).map(q=>({id:`${year}-${q.qnum}`,data:{...q,year}})));
 const proposals=before.map(r=>({id:r.id,explanation:cache[r.id]}));
 assert.equal(proposals.length,358);
 validateExplanations(before,proposals,years);
 for(const p of proposals){
  assert.ok(p.explanation.length<=450,p.id);
  assert.equal(p.explanation.split('\n\n').length,2,p.id);
  const q=before.find(r=>r.id===p.id).data;
  const numbers=p.explanation.split('。')[0].match(/[1-5]/g)?.join('');
  if(q.answer.length===1&&numbers&&/^\([1-5]\)/.test(q.choices[q.answer])) assert.equal(numbers,q.choices[q.answer].match(/[1-5]/g).join(''),p.id);
 }
});
