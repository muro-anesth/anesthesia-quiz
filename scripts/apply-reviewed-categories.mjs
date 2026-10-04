import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {validateCategoryPlan,applyReviewedCategories} from './reviewed-category-update.mjs';
import {saveReceiptAtomic,verifyAppliedReceipt} from './category-receipt.mjs';

const [planPath,snapshotPath,...flags]=process.argv.slice(2);
assert.ok(planPath&&snapshotPath&&path.isAbsolute(planPath)&&path.isAbsolute(snapshotPath),'Use absolute reviewed-plan and pre-change snapshot paths');
const verifyReceipt=flags[0]==='--verify-applied'?flags[1]:null;
assert.ok(flags.length===0 || flags.length===1&&flags[0]==='--apply' || flags.length===2&&flags[0]==='--verify-applied'&&path.isAbsolute(verifyReceipt),'Use --apply or --verify-applied /absolute/receipt.json');
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
 const digest=crypto.createHash('sha256').update(raw).digest('hex');
 const changeSummary=changes.map(q=>({id:q.id,from:q.original.category??null,to:q.category}));
 if(!verifyReceipt) current.forEach((q,i)=>assert.ok(q.exists&&isDeepStrictEqual(JSON.parse(JSON.stringify(q.data())),changes[i].original),`${changes[i].id}: changed since review`));
 console.log(JSON.stringify({project:'periop-quiz',mode:verifyReceipt?'verify-applied':flags.includes('--apply')?'apply':'dry-run',changes:changes.length,sha256:digest}));
 if(verifyReceipt){
  // Recovery after a successful commit but interrupted read-back. No DB writes.
  const record=JSON.parse(readFileSync(verifyReceipt));
  const verified=verifyAppliedReceipt(record,{planPath,snapshotPath,digest,changes,current:current.map(q=>({id:q.id,exists:q.exists,data:q.exists?JSON.parse(JSON.stringify(q.data())):null}))});
  saveReceiptAtomic(verifyReceipt,{...verified,verifiedAt:new Date().toISOString()});
  console.log('Applied categories verified without database writes');
 }
 if(flags.includes('--apply')){
  const dir=path.join(path.dirname(planPath),'receipts');mkdirSync(dir,{recursive:true});
  const receipt=path.join(dir,`category-${Date.now()}-${digest.slice(0,12)}.json`);
  const record={project:'periop-quiz',planPath,snapshotPath,sha256:digest,changes:changeSummary,status:'prepared',startedAt:new Date().toISOString()};
  saveReceiptAtomic(receipt,record,{exclusive:true});
  await applyReviewedCategories(db,plan,before);
  const after=await db.getAll(...refs);
  after.forEach((q,i)=>assert.ok(q.exists&&isDeepStrictEqual(JSON.parse(JSON.stringify(q.data())),{...changes[i].original,category:changes[i].category}),`${changes[i].id}: post-update mismatch`));
  saveReceiptAtomic(receipt,{...record,status:'verified',verifiedAt:new Date().toISOString()});
  console.log(`Verified category-only changes; receipt ${receipt}`);
 }
}finally{await db.terminate();}
