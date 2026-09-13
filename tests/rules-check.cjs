// Firebase's rules test endpoint evaluates synthetic requests without writing data or releasing rules.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = execFileSync('npm', ['root', '-g'], {encoding:'utf8'}).trim();
const auth = require(path.join(root, 'firebase-tools/lib/auth.js'));
(async()=>{
 const account = auth.getGlobalDefaultAccount();
 if(!account) throw Error('Run firebase login first');
 const token = await auth.getAccessToken(account.tokens.refresh_token, []);
 const cases = JSON.parse(fs.readFileSync('tests/rules-cases.json'));
 const payload = {source:{files:[{name:'firestore.rules',content:fs.readFileSync('firestore.rules','utf8')}]},testSuite:{testCases:cases.map(([,uid,method,document,expectation])=>({expectation,request:{auth:uid?{uid,token:{}}:null,method,path:'/databases/(default)/documents/'+document,resource:{data:{role:'admin'}}},resource:{data:{role:'user'}},pathEncoding:'PLAIN'}))}};
 const response = await fetch('https://firebaserules.googleapis.com/v1/projects/periop-quiz:test',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const result = await response.json();
 if(!response.ok) throw Error('Rules test failed: HTTP '+response.status);
 if(result.issues?.length) console.log(result.issues);
 const outcomes = result.testResults || [];
 outcomes.forEach((r,i)=>console.log(r.state, cases[i][0]));
 if(outcomes.length!==cases.length || outcomes.some(r=>r.state!=='SUCCESS') || result.issues?.some(x=>x.severity==='ERROR')) process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
