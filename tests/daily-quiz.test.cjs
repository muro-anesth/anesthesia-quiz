const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: name => { if (!(name in mocks)) throw Error('Unmocked dependency: '+name); return mocks[name]; } });
  return exports;
}
const p = load('src/features/quiz/dailyQuizPlanner.ts');
const now = Date.parse('2026-10-04T00:00:00Z');

test('daily planner mixes 8 due / 8 unseen / 4 latest wrong without duplicates', () => {
  const due = Array.from({length:8},(_,i)=>({questionId:'d'+i,due:now-1}));
  const attempts = Array.from({length:4},(_,i)=>({id:'a'+i,questionId:'w'+i,isCorrect:false,answeredAt:now-i}));
  const ids = [...due.map(d=>d.questionId),...Array.from({length:12},(_,i)=>'n'+i),...attempts.map(a=>a.questionId)];
  const result = Array.from(p.planDailyQuiz(ids,due,attempts,now));
  assert.equal(result.length,20);assert.equal(new Set(result).size,20);
  assert.equal(result.filter(id=>id.startsWith('d')).length,8);
  assert.equal(result.filter(id=>id.startsWith('n')).length,8);
  assert.equal(result.filter(id=>id.startsWith('w')).length,4);
});
test('daily planner fills sparse pools, ignores removed IDs, and uses latest correctness', () => {
  assert.equal(p.planDailyQuiz([],[],[],now).length,0);
  assert.deepEqual(Array.from(p.planDailyQuiz(['a','a','b'],[{questionId:'deleted',due:0}],[],now)).sort(),['a','b']);
  const ids=Array.from({length:20},(_,i)=>'q'+i);
  const attempts=ids.map(questionId=>({id:questionId,questionId,isCorrect:true,answeredAt:now}));
  attempts.push({id:'old',questionId:'q1',isCorrect:false,answeredAt:now-1});
  assert.deepEqual(Array.from(p.planDailyQuiz(ids,[],attempts,now)),Array.from(p.planDailyQuiz(ids,[],attempts.slice(0,-1),now)));
  assert.equal(p.planDailyQuiz(ids,[],attempts,now).length,20);
});
test('daily storage is UID/JST-date scoped and validates/whitelists metadata', () => {
  assert.equal(p.dailyDate(Date.parse('2026-10-03T14:59:59Z')),'2026-10-03');
  assert.equal(p.dailyDate(Date.parse('2026-10-03T15:00:00Z')),'2026-10-04');
  assert.notEqual(p.dailyStorageKey('alice','2026-10-04'),p.dailyStorageKey('bob','2026-10-04'));
  const s={version:2,date:'2026-10-04',token:'session-nonce',ids:['q1'],done:[]};
  assert.equal(p.parseDailySession(JSON.stringify(s),'2026-10-05'),null);
  assert.equal(p.parseDailySession('{','2026-10-04'),null);
  assert.equal(p.parseDailySession(JSON.stringify({...s,ids:['q1','q1']}),s.date),null);
  assert.equal(p.parseDailySession(JSON.stringify({...s,ids:Array.from({length:21},(_,i)=>'q'+i)}),s.date),null);
  assert.equal(p.parseDailySession(JSON.stringify({...s,version:1}),s.date),null);
  assert.equal(p.parseDailySession(JSON.stringify({...s,stem:'private',answer:'a'}),s.date).stem,undefined);
});
test('daily recovery recognizes committed attempts and excludes deleted unasked items', () => {
  const s={version:2,date:'2026-10-04',token:'nonce',ids:['q1','q2','q3'],done:[]};
  const recovered=p.reconcileDailySession(s,['q3'],[{id:p.dailyAttemptId(s,'q1'),questionId:'q1',isCorrect:true,answeredAt:now}]);
  assert.deepEqual(Array.from(recovered.ids),['q1','q3']);
  assert.equal(recovered.done.length,1);assert.equal(recovered.done[0].id,'q1');
  assert.equal(s.done.length,0);
});
test('daily data loader reads only public questions and current user history once', async () => {
  const reads=[];
  const records={questions:[{id:'q1',year:'2025a'},{id:'hidden',year:'2099a'}], 'users/u/progress':[{id:'q1',due:{toMillis:()=>123}}], 'users/u/attempts':[{id:'attempt',questionId:'q1',isCorrect:false,answeredAt:{toMillis:()=>456}}]};
  const api=load('src/lib/dailyQuizData.ts',{
    './firebase':{db:{}}, './questionYears.json':{default:['2025a']},
    'firebase/firestore':{collection:(_, ...parts)=>parts.join('/'),doc:(_, ...parts)=>parts.join('/'),getDocs:async key=>{reads.push(key);return {docs:records[key].map(({id,...data})=>({id,data:()=>data}))}},getDoc:async()=>({exists:()=>false})},
  });
  const result=await api.loadDailyQuizData('u');
  assert.deepEqual(reads.sort(),['questions','users/u/attempts','users/u/progress']);
  assert.equal(result.questions.length,1);assert.equal(result.progress[0].due,123);assert.equal(result.attempts[0].answeredAt,456);
  assert.equal(await api.getDailyQuizQuestion('deleted'),null);
});
test('daily planner balances categories across buckets and fallback with a skewed bank',()=>{
  const ids=Array.from({length:60},(_,i)=>'q'+i);
  const categories=Object.fromEntries(ids.map((id,i)=>[id,i<40?'large':i<50?'medium':'small']));
  const result=Array.from(p.planDailyQuiz(ids,[],[],now,categories));
  const counts=Object.values(result.reduce((acc,id)=>{acc[categories[id]]=(acc[categories[id]]??0)+1;return acc},{}));
  assert.equal(result.length,20);assert.equal(counts.length,3);assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
  assert.deepEqual(result,Array.from(p.planDailyQuiz(ids,[],[],now,categories)));
});
test('daily planner avoids earlier sets before reusing, including surplus due questions',()=>{
  const ids=Array.from({length:45},(_,i)=>'q'+i),due=ids.map(questionId=>({questionId,due:0}));
  const first=Array.from(p.planDailyQuiz(ids,due,[],now));
  const second=Array.from(p.planDailyQuiz(ids,due,[],now,{},first));
  assert.equal(second.length,20);assert.ok(second.every(id=>!first.includes(id)));
  const third=Array.from(p.planDailyQuiz(ids,due,[],now,{},[...first,...second]));
  assert.equal(third.length,20);assert.equal(third.filter(id=>!first.includes(id)&&!second.includes(id)).length,5);
  assert.equal(new Set(third).size,20);
  const tiny=Array.from(p.planDailyQuiz(['a','b'],[],[],now,{},['a','b']));assert.equal(tiny.length,2);
});
