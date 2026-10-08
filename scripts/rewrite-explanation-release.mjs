import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {validateExplanations} from './explanation-validation.mjs';
// Keep snapshots/review material outside the public repository.
const dir=process.argv[3];
assert.ok(dir&&path.isAbsolute(dir),'Provide an absolute private release directory');
const mode=process.argv[2];assert.ok(['snapshot','check','apply','verify'].includes(mode));
const years=['2023a','2023b','2024a','2024b','2025a','2025b'];
const snapshotPath=path.join(dir,'questions-before.json');
fs.mkdirSync(dir,{recursive:true});
if(mode==='snapshot'){
 assert.ok(!fs.existsSync(snapshotPath),'Snapshot already exists; never overwrite');
}
const account=JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));assert.equal(account.project_id,'periop-quiz');
initializeApp({credential:cert(account),projectId:'periop-quiz'});const db=getFirestore();
try{
 const live=await db.collection('questions').get();const all=live.docs.map(d=>({id:d.id,data:JSON.parse(JSON.stringify(d.data()))}));
 if(mode==='snapshot'){
  fs.writeFileSync(snapshotPath,JSON.stringify(all,null,2),{flag:'wx',mode:0o600});
  for(const year of years){const rows=all.filter(r=>r.data.year===year);fs.writeFileSync(path.join(dir,year+'-source.json'),JSON.stringify(rows,null,2),{flag:'wx',mode:0o600});console.log(year,rows.length);}
  console.log('Snapshot saved; no database writes',all.length);
 }else{
  const before=JSON.parse(fs.readFileSync(snapshotPath));const proposals=years.flatMap(y=>JSON.parse(fs.readFileSync(path.join(dir,y+'-rewritten.json'))));
  validateExplanations(before,proposals,years);
  const map=new Map(before.map(r=>[r.id,r.data]));
  const proposed=new Map(proposals.map(p=>[p.id,p.explanation]));
  if(mode==='verify'){
   assert.equal(all.length,before.length);
   all.forEach(r=>assert.ok(isDeepStrictEqual(r.data,{...map.get(r.id),...(proposed.has(r.id)?{explanation:proposed.get(r.id)}:{})}),r.id+': unexpected change'));
   console.log('Verified published explanations and all unchanged non-explanation fields');
   process.exitCode=0;
  }else{
  assert.equal(all.length,before.length);all.forEach(r=>assert.ok(isDeepStrictEqual(r.data,map.get(r.id)),r.id+': changed since snapshot'));
  console.log('Validated',proposals.length,'explanation-only changes');
  if(mode==='apply'){
   assert.ok(!fs.existsSync(path.join(dir,'receipt.json')),'Already applied; use verify instead');
   // One atomic batch with update-time preconditions: concurrent edits abort the whole release.
   const batch=db.batch(),time=new Map(live.docs.map(d=>[d.id,d.updateTime]));
   for(const p of proposals)batch.update(db.collection('questions').doc(p.id),{explanation:p.explanation},{lastUpdateTime:time.get(p.id)});
   await batch.commit();
   const after=await db.collection('questions').get();assert.equal(after.size,before.length);
   for(const d of after.docs){const expected={...map.get(d.id),...(proposed.has(d.id)?{explanation:proposed.get(d.id)}:{})};assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(d.data())),expected),d.id+': non-explanation change');}
   fs.writeFileSync(path.join(dir,'receipt.json'),JSON.stringify({project:'periop-quiz',count:proposals.length,verifiedAt:new Date().toISOString(),sha256:crypto.createHash('sha256').update(JSON.stringify(proposals)).digest('hex')},null,2),{flag:'wx',mode:0o600});
   console.log('Committed and verified: every non-explanation field and other year unchanged; no user/history access');
  }
  }
 }
}finally{await db.terminate();}
