import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {validateCategoryPlan,applyReviewedCategories} from './reviewed-category-update.mjs';

const [planPath,snapshotPath,...flags]=process.argv.slice(2);
assert.ok(planPath&&snapshotPath&&path.isAbsolute(planPath)&&path.isAbsolute(snapshotPath),'Use absolute reviewed-plan and pre-change snapshot paths');
assert.ok(flags.length<=1&&flags.every(f=>f==='--apply'),'Only optional --apply is supported');
assert.ok(!process.env.FIRESTORE_EMULATOR_HOST,'Unexpected emulator');
const raw=readFileSync(planPath),plan=JSON.parse(raw),before=JSON.parse(readFileSync(snapshotPath));
const changes=validateCategoryPlan(plan,before);
const account=JSON.parse(readFileSync('scripts/serviceAccountKey.json'));
assert.equal(account.project_id,'periop-quiz','Wrong project');
initializeApp({credential:cert(account),projectId:'periop-quiz'});
const db=getFirestore();
try{
 const refs=changes.map(q=>db.collection('questions').doc(q.id));
 const current=await db.getAll(...refs);
 current.forEach((q,i)=>assert.ok(q.exists&&isDeepStrictEqual(JSON.parse(JSON.stringify(q.data())),changes[i].original),`${changes[i].id}: changed since review`));
 const digest=crypto.createHash('sha256').update(raw).digest('hex');
 console.log(JSON.stringify({project:'periop-quiz',mode:flags.includes('--apply')?'apply':'dry-run',changes:changes.length,sha256:digest}));
 if(flags.includes('--apply')){
  const dir=path.join(path.dirname(planPath),'receipts');mkdirSync(dir,{recursive:true});
  const receipt=path.join(dir,`category-${Date.now()}-${digest.slice(0,12)}.json`);
  const record={project:'periop-quiz',planPath,snapshotPath,sha256:digest,changes:changes.map(q=>({id:q.id,from:q.original.category??null,to:q.category})),status:'prepared',startedAt:new Date().toISOString()};
  writeFileSync(receipt,JSON.stringify(record,null,2),{flag:'wx',mode:0o600});
  await applyReviewedCategories(db,plan,before);
  const after=await db.getAll(...refs);
  after.forEach((q,i)=>assert.ok(q.exists&&isDeepStrictEqual(JSON.parse(JSON.stringify(q.data())),{...changes[i].original,category:changes[i].category}),`${changes[i].id}: post-update mismatch`));
  writeFileSync(receipt,JSON.stringify({...record,status:'verified',verifiedAt:new Date().toISOString()},null,2),{mode:0o600});
  console.log(`Verified category-only changes; receipt ${receipt}`);
 }
}finally{await db.terminate();}
