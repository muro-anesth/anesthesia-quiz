import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {validateScanImport} from './scan-import-validation.mjs';
import {verifyPublishedScanImages} from './verify-published-scan-images.mjs';

const files=process.argv.slice(2);
assert.ok(files.length>0&&files.every(f=>path.isAbsolute(f)),'Provide absolute reviewed release bundles');
assert.ok(!process.env.FIRESTORE_EMULATOR_HOST,'Unexpected emulator');
const rows=files.flatMap(f=>validateScanImport(JSON.parse(readFileSync(f))));
assert.equal(new Set(rows.map(q=>q.id)).size,rows.length,'Duplicate release IDs');
const account=JSON.parse(readFileSync('scripts/serviceAccountKey.json'));
assert.equal(account.project_id,'periop-quiz','Wrong project');
initializeApp({credential:cert(account),projectId:'periop-quiz'});
const db=getFirestore();
try{
 for(let offset=0;offset<rows.length;offset+=200){
  const batch=rows.slice(offset,offset+200),snaps=await db.getAll(...batch.map(q=>db.collection('questions').doc(q.id)));
  snaps.forEach((q,i)=>assert.ok(q.exists&&isDeepStrictEqual(q.data(),batch[i].data),`${batch[i].id}: released data mismatch`));
 }
 const images=await verifyPublishedScanImages(rows);
 console.log(JSON.stringify({verifiedQuestions:rows.length,verifiedImages:images,years:[...new Set(rows.map(q=>q.data.year))],databaseWrites:0}));
}finally{await db.terminate();}
