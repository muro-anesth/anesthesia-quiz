import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {validateScanImport,createScanQuestions} from './scan-import-validation.mjs';

const args=process.argv.slice(2);
const filename=args.find(a=>!a.startsWith('--'));
if(!filename || args.some(a=>a.startsWith('--') && a!=='--apply'))throw Error('Usage: node scripts/import-reviewed-scans.mjs /absolute/reviewed-bundle.json [--apply]');
if(!path.isAbsolute(filename))throw Error('Require absolute bundle path');
if(process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator configured: use a dedicated test harness, not production importer');
const raw=readFileSync(filename);
const bundle=JSON.parse(raw);
const rows=validateScanImport(bundle);
if(rows.length>400)throw Error('At most 400 questions per reviewed bundle');
for(const q of rows){
 for(const image of [q.data.main_image,...q.data.option_images].filter(Boolean)){
  if(!existsSync(path.join('public','quiz-images',q.data.year,image)))throw Error(`${q.id}: image asset missing`);
 }
}
const account=JSON.parse(readFileSync('scripts/serviceAccountKey.json','utf8'));
if(account.project_id!=='periop-quiz')throw Error('Wrong Firebase project');
initializeApp({credential:cert(account),projectId:'periop-quiz'});
const db=getFirestore();
const snapshots=await db.getAll(...rows.map(q=>db.collection('questions').doc(q.id)));
const existing=snapshots.filter(s=>s.exists).map(s=>s.id);
if(existing.length)throw Error(`Aborted: existing IDs ${existing.join(', ')}`);
const digest=crypto.createHash('sha256').update(raw).digest('hex');
console.log(JSON.stringify({project:'periop-quiz',mode:args.includes('--apply')?'apply':'dry-run',count:rows.length,sha256:digest,years:[...new Set(rows.map(q=>q.data.year))]},null,2));
if(args.includes('--apply')){
 const dir=path.join(path.dirname(filename),'receipts');mkdirSync(dir,{recursive:true});
 const receipt=path.join(dir,`${Date.now()}-${digest.slice(0,12)}.json`);
 const record={project:'periop-quiz',bundle:filename,sha256:digest,ids:rows.map(q=>q.id),startedAt:new Date().toISOString(),status:'prepared'};
 // Persist intent before any remote write. A retry aborts on existing IDs;
 // it never changes/removes them even if the previous receipt write failed.
 writeFileSync(receipt,JSON.stringify(record,null,2),{flag:'wx',mode:0o600});
 await createScanQuestions(db,rows);
 const after=await db.getAll(...rows.map(q=>db.collection('questions').doc(q.id)));
 for(let i=0;i<rows.length;i++){
  const value=after[i].data();
  if(!isDeepStrictEqual(value,rows[i].data))throw Error(`Post-import verification failed: ${rows[i].id}`);
 }
 writeFileSync(receipt,JSON.stringify({...record,status:'verified',verifiedAt:new Date().toISOString()},null,2),{mode:0o600});
 console.log(`Verified ${rows.length} newly created questions; receipt ${receipt}`);
}
await db.terminate();
