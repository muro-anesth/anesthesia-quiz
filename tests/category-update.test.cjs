const test=require('node:test');
const assert=require('node:assert/strict');
const before=[{id:'2025a-1',data:{stem:'医療機器の試験設問',answer:'a',category:'未分類',choices:{a:'保持'}}}];
const plan=()=>({schemaVersion:1,changes:[{id:'2025a-1',category:'CE関連',review:{approved:true,reason:'医療機器の電気安全を問う設問のため。'}}]});
test('reviewed CE reclassification writes category only and aborts on stale source',async()=>{
 const {applyReviewedCategories}=await import('../scripts/reviewed-category-update.mjs');
 const writes=[],collections=[];
 let current=structuredClone(before[0].data);
 const db={collection:name=>{collections.push(name);return {doc:id=>({id})}},runTransaction:async f=>f({getAll:async()=>[{exists:true,data:()=>current}],update:(ref,data)=>writes.push({ref,data})})};
 assert.equal(await applyReviewedCategories(db,plan(),before),1);
 assert.deepEqual(writes,[{ref:{id:'2025a-1'},data:{category:'CE関連'}}]);
 assert.deepEqual(collections,['questions']);
 current.stem='別端末で変更';
 await assert.rejects(()=>applyReviewedCategories(db,plan(),before),/changed since review/);
 assert.equal(writes.length,1);
});
test('category plans reject unreviewed, ambiguous, duplicate and out-of-scope changes',async()=>{
 const {validateCategoryPlan}=await import('../scripts/reviewed-category-update.mjs');
 for(const mutate of [p=>p.changes[0].review.approved=false,p=>p.changes[0].review.reason='',p=>p.changes[0].category='未分類',p=>p.changes[0].id='users/secret',p=>p.changes.push(p.changes[0]),p=>p.changes[0].id='2015a-1']){
  const p=plan();mutate(p);assert.throws(()=>validateCategoryPlan(p,before));
 }
});
