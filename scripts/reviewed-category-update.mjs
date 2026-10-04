import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
const categories=JSON.parse(readFileSync(new URL('../src/lib/questionCategories.json',import.meta.url)));

// A reviewed plan changes only category metadata. Original answers and user
// history are deliberately outside this module's write surface.
export function validateCategoryPlan(plan,before){
 assert.equal(plan.schemaVersion,1);
 assert.ok(Array.isArray(before)&&before.length>0,'Pre-change snapshot required');
 assert.equal(plan.snapshotSha256,createHash('sha256').update(JSON.stringify(before)).digest('hex'),'Plan must bind to the reviewed snapshot');
 assert.ok(Array.isArray(plan.changes)&&plan.changes.length>0&&plan.changes.length<=400,'Invalid plan size');
 const originals=new Map(before.map(q=>[q.id,q.data]));
 assert.equal(originals.size,before.length,'Duplicate snapshot IDs');
 const seen=new Set();
 return plan.changes.map(change=>{
  assert.ok(/^(2023|2024|2025)[ab]-[1-9]\d*$/.test(change.id),'Existing-year question required');
  assert.ok(!seen.has(change.id),'Duplicate change');seen.add(change.id);
  const original=originals.get(change.id);
  assert.ok(original,'Question missing from snapshot');
  assert.equal(change.review?.approved,true,'Human review required');
  assert.ok(typeof change.review.reason==='string'&&change.review.reason.trim().length>=10,'Classification rationale required');
  assert.ok(categories.includes(change.category)&&change.category!=='未分類','Unknown or unresolved category');
  assert.notEqual(change.category,original.category,'No-op change');
  return {id:change.id,category:change.category,original};
 });
}

export async function applyReviewedCategories(db,plan,before){
 const changes=validateCategoryPlan(plan,before);
 return db.runTransaction(async tx=>{
  const refs=changes.map(q=>db.collection('questions').doc(q.id));
  const current=await tx.getAll(...refs);
  // Abort the entire update if ANY source field changed after review.
  current.forEach((snapshot,i)=>{
   assert.ok(snapshot.exists,`${changes[i].id}: disappeared`);
   assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(snapshot.data())),changes[i].original),`${changes[i].id}: changed since review`);
  });
  changes.forEach((change,i)=>tx.update(refs[i],{category:change.category}));
  return changes.length;
 });
}
