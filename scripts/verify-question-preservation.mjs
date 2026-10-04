import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const before=JSON.parse(readFileSync(process.argv[2]));
if(!Array.isArray(before)||before.length===0)throw Error('Missing pre-import question snapshot');
const account=JSON.parse(readFileSync('scripts/serviceAccountKey.json'));
if(account.project_id!=='periop-quiz')throw Error('Wrong project');
if(process.env.FIRESTORE_EMULATOR_HOST)throw Error('Unexpected emulator');
initializeApp({credential:cert(account),projectId:'periop-quiz'});
const db=getFirestore();
const after=await db.getAll(...before.map(q=>db.collection('questions').doc(q.id)));
const changed=[];
for(let i=0;i<before.length;i++){
 const data=after[i].exists?JSON.parse(JSON.stringify(after[i].data())):null;
 if(!isDeepStrictEqual(data,before[i].data))changed.push(before[i].id);
}
if(changed.length)throw Error(`Existing question mismatch: ${changed.join(', ')}`);
console.log(`Verified ${before.length} existing questions are unchanged. No user collections read or written.`);
await db.terminate();
