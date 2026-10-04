const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
function readDailySession(storage) {
  return [...storage.entries()].filter(([key])=>!key.endsWith(':seen')).map(([,value])=>JSON.parse(value)).at(-1);
}
function load(file, mocks, cache = new Map()) {
  const path = require("node:path");
  file = path.resolve(file);
  if(file.endsWith('.json')) return {default:JSON.parse(fs.readFileSync(file,'utf8'))};
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const exports = {};
  cache.set(file, exports);
  const resolve = (id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith(".") || id.startsWith("@/")) {
      const base = id.startsWith("@/")
        ? path.resolve("src", id.slice(2))
        : path.resolve(path.dirname(file), id);
      const target = [
        base,
        base + ".ts",
        base + ".tsx",
        base + "/index.ts",
      ].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (target) return load(target, mocks, cache);
    }
    return require(id);
  };
  class TestDate extends Date {
    static now() {
      return mocks.__now?.() ?? 1800000000000;
    }
  }
  class Audio {
    constructor(src) {
      this.src = "http://localhost" + src;
    }
    play() {
      return Promise.resolve();
    }
    pause() {}
  }
  vm.runInNewContext(output, {
    exports,
    require: resolve,
    crypto: require("node:crypto").webcrypto,
    window: { location: { origin: "http://localhost", replace() {} }, ...mocks.__window },
    console,
    Date: TestDate,
    Audio,
    Promise,
    setTimeout,
  });
  return exports;
}
const q = (id) => ({
  id,
  qnum: Number(id.slice(1)),
  year: "2025a",
  category: "気道管理",
  stem: "問題 " + id,
  choices: { a: "選択肢A", b: "選択肢B" },
  answer: "a",
  explanation: "解説",
});
async function setup(options = {}) {
  const storage = options.storage ?? new Map();
  const calls = [],
    questions = { q1: q("q1"), q2: q("q2") };
  let fail = false;
  const helpers = {
    getUserProfile: async () => ({
      username: "test",
      role: options.admin ? "admin" : "user",
    }),
    getYears: async () => options.years ?? ["2025a"],
    getCategories: async () => ["気道管理"],
    getReviewQueue: async () => ({
      total: 2,
      cards: [{ questionId: "q1" }, { questionId: "q2" }],
    }),
    getNextQuestion: async () => {
      calls.push("random");
      return {
        question: options.empty
          ? null
          : options.question ?? { ...q("q9"), answer: options.multi ? "ab" : "a" },
      };
    },
    saveAttempt: async (...args) => {
      calls.push(args);
      if (fail) throw Error("offline");
      if (options.onSave) return options.onSave(...args);
    },
  };
  Object.assign(helpers, {
    getStats: async () => ({
      total: 2,
      rate: 50,
      recentTotal: 2,
      categories: [{ name: "気道管理", correct: 1, total: 2, rate: 50 }],
      learning: {publicTotal:2,attemptedUnique:2,coverageRate:100,firstAnswered:2,firstCorrect:1,firstRate:50,changedToCorrect:0,excludedAttempts:0,invalidDateQuestions:0,ambiguousFirstQuestions:0,ambiguousLatestQuestions:0},
      categoryLearning: [{name:"気道管理",publicTotal:2,attemptedUnique:2,coverageRate:100,firstAnswered:2,firstCorrect:1,firstRate:50,unscoredInitialQuestions:0}],
      statsError: false,
    }),
    getUsers: async () => [{ uid: "test", username: "test", role: "user" }],
    getQuestionsForYear: async (year) => options.examQuestions?.[year] ?? [
      { ...q(year.endsWith("a") ? "q1" : "q2"), year },
    ],
    saveExamResult: async (uid, result) => calls.push(["exam", result]),
    getExamHistory: async () => [
      {
        id: "e1",
        year: "2025",
        score: 50,
        totalQuestions: 2,
        correctAnswers: 1,
        elapsedSeconds: 0,
        date: { toDate: () => new Date("2026-09-13T12:00:00Z") },
      },
    ],
  });
  const Quiz = load("src/app/quiz/page.tsx", {
    __now: options.now,
    __window: { localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => { if (options.storageFails?.()) throw Error('storage unavailable'); storage.set(key, value); },
    }, ...options.browser },
    "@/lib/dailyQuizData": {
      loadDailyQuizData: async () => {
        calls.push('daily-load');
        if (options.dailyLoad) return options.dailyLoad();
        return { questions: options.dailyQuestions ?? [q('q1'),q('q2')], progress: [], attempts: options.dailyAttempts ?? [] };
      },
      getDailyQuizQuestion: async id => {
        calls.push('daily-one:'+id);
        if (options.dailyGet) return options.dailyGet(id);
        return (options.dailyQuestions ?? [q('q1'),q('q2')]).find(q=>q.id===id) ?? null;
      },
    },
    "firebase/auth": {
      onAuthStateChanged: (_, cb) => {
        cb({ uid: options.uid ?? "test" });
        return () => {};
      },
    },
    "@/lib/firebase": { auth: {}, db: {} },
    "@/lib/firebaseHelpers": helpers,
    "@/lib/srs": {
      SRS_OPTIONS: load("src/lib/srs.ts", {}).SRS_OPTIONS,
    },
    "firebase/firestore": {
      doc: (_, c, id) => id,
      getDoc: async (id) => ({
        id,
        exists: () => true,
        data: () => questions[id],
      }),
    },
  }).default;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Quiz));
  });
  const text = (n) =>
    typeof n === "string" ? n : (n?.children || []).map(text).join("");
  async function click(label) {
    const button = renderer.root
      .findAllByType("button")
      .find((b) => text(b).includes(label));
    assert.ok(button, label);
    await act(async () => {
      await button.props.onClick();
    });
  }
  return {
    storage,
    calls,
    renderer,
    click,
    clickChoice: async (key) => {
      const button=renderer.root.findAllByType('button').find(b=>text(b).startsWith(key.toUpperCase()+'.'));
      assert.ok(button,`Choice ${key}`);
      await act(async()=>button.props.onClick());
    },
    fail: (v) => (fail = v),
    text: () => text(renderer.toJSON()),
    close: async () => act(() => renderer.unmount()),
  };
}
test('daily loads once, stops at twenty saved answers, and shows actual result', async () => {
  const s=await setup({dailyQuestions:Array.from({length:45},(_,i)=>q('q'+(i+1)))});
  await s.click('今日の20問');
  for(let i=0;i<20;i++){
    assert.match(s.text(),new RegExp(`${i+1} / 20問`));
    await s.clickChoice('a');
    assert.equal(s.calls.filter(Array.isArray).length,i);
    await s.click('思い出せた');
  }
  assert.match(s.text(),/完了：20 \/ 20問/);
  assert.match(s.text(),/正解 20 \/ 回答済み 20問/);
  assert.equal(s.calls.filter(x=>x==='daily-load').length,1);
  assert.equal(s.calls.filter(x=>x==='random').length,0);
  const saved=s.calls.filter(Array.isArray);
  assert.equal(new Set(saved.map(x=>x[1])).size,20);
  await s.click('ホームに戻る');assert.match(s.text(),/次の20問/);
  await s.click('今日の20問');assert.match(s.text(),/1 \/ 20問/);
  assert.equal(s.calls.filter(x=>x==='daily-load').length,2);
  const next=readDailySession(s.storage);assert.ok(next.ids.every(id=>!saved.some(c=>c[1]===id)));
  const local=JSON.stringify([...s.storage]);
  assert.ok(!local.includes('選択肢'));assert.ok(!local.includes('explanation'));assert.ok(!local.includes('isCorrect'));
  await s.close();
});
test('daily resumes after partial finish/reload, and does not leak progress across UIDs', async()=>{
  const storage=new Map();let s=await setup({storage});
  await s.click('今日の20問');await s.clickChoice('a');await s.click('今日はここまで');await s.click('思い出せた');
  assert.match(s.text(),/途中保存：1 \/ 2問/);await s.close();
  s=await setup({storage});assert.match(s.text(),/続きから/);await s.click('今日の20問');assert.match(s.text(),/2 \/ 2問/);
  await s.clickChoice('a');await s.click('思い出せた');assert.match(s.text(),/完了：2 \/ 2問/);await s.close();
  s=await setup({storage,uid:'another'});assert.match(s.text(),/始める/);await s.click('今日の20問');assert.match(s.text(),/1 \/ 2問/);await s.close();
});
test('daily retries failed saving with same attempt ID and does not advance',async()=>{
  const s=await setup();await s.click('今日の20問');await s.clickChoice('a');s.fail(true);
  await s.click('思い出せた');assert.match(s.text(),/失敗しました/);assert.match(s.text(),/1 \/ 2問/);
  assert.equal(readDailySession(s.storage).done.length,0);
  s.fail(false);await s.click('思い出せた');assert.match(s.text(),/2 \/ 2問/);
  const calls=s.calls.filter(Array.isArray);assert.equal(calls[0][5],calls[1][5]);await s.close();
});
test('daily double starts and rating double clicks cannot duplicate work',async()=>{
  let release;const wait=new Promise(r=>release=r);
  const s=await setup({dailyLoad:async()=>{await wait;return {questions:[q('q1')],progress:[],attempts:[]}}});
  const start=s.renderer.root.findAllByType('button').find(b=>String(b.children).includes('今日の20問'));
  await act(async()=>{const first=start.props.onClick();const second=start.props.onClick();release();await Promise.all([first,second]);});
  assert.equal(s.calls.filter(x=>x==='daily-load').length,1);
  await s.clickChoice('a');
  const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
  const rating=s.renderer.root.findAllByType('button').find(b=>text(b).includes('思い出せた'));
  assert.ok(rating);
  await act(async()=>Promise.all([rating.props.onClick(),rating.props.onClick()]));
  assert.equal(s.calls.filter(Array.isArray).length,1);assert.match(s.text(),/完了：1 \/ 1問/);await s.close();
});
test('daily zero questions and deleted questions finish with actual count',async()=>{
  let s=await setup({dailyQuestions:[]});await s.click('今日の20問');assert.match(s.text(),/出題できる問題はありません/);assert.equal(s.calls.filter(Array.isArray).length,0);await s.close();
  let reads=0;
  s=await setup({dailyGet:async id=>++reads===1?q(id):null});await s.click('今日の20問');
  await s.clickChoice('a');await s.click('思い出せた');assert.match(s.text(),/完了：1 \/ 1問/);assert.equal(s.calls.filter(Array.isArray).length,1);await s.close();
});
test('daily unfinished question resumes without saving and free quiz remains separate',async()=>{
  const s=await setup();await s.click('今日の20問');const first=readDailySession(s.storage).ids[0];
  await s.click('← ホーム');assert.equal(s.calls.filter(Array.isArray).length,0);
  await s.click('今日の20問');assert.ok(s.text().includes('問題 '+first));await s.click('← ホーム');
  await s.click('クイズ');assert.match(s.text(),/問題 q9/);assert.ok(!s.text().includes('今日の20問 ·'));await s.close();
});
test('daily resumes committed-but-unacknowledged save without a duplicate answer',async()=>{
  const storage=new Map();let s=await setup({storage});await s.click('今日の20問');await s.clickChoice('a');s.fail(true);await s.click('思い出せた');
  const call=s.calls.filter(Array.isArray)[0];await s.close();
  s=await setup({storage,dailyAttempts:[{id:call[5],questionId:call[1],isCorrect:true,answeredAt:Date.now()}]});
  await s.click('今日の20問');assert.match(s.text(),/2 \/ 2問/);assert.equal(s.calls.filter(Array.isArray).length,0);await s.close();
});
test('daily failed next-item read retries prior save ID without advancing twice',async()=>{
  let failNext=false;const s=await setup({dailyGet:async id=>{if(failNext)throw Error('offline');return q(id)}});
  await s.click('今日の20問');await s.clickChoice('a');failNext=true;await s.click('思い出せた');assert.match(s.text(),/失敗しました/);
  failNext=false;await s.click('思い出せた');const calls=s.calls.filter(Array.isArray);assert.equal(calls[0][5],calls[1][5]);
  assert.equal(readDailySession(s.storage).done.length,1);await s.close();
});
test('daily storage failure before start prevents answering; failure after save allows safe retry',async()=>{
  let broken=true;const s=await setup({storageFails:()=>broken});await s.click('今日の20問');assert.match(s.text(),/開始できませんでした/);assert.equal(s.calls.filter(Array.isArray).length,0);
  broken=false;await s.click('今日の20問');await s.clickChoice('a');broken=true;await s.click('思い出せた');assert.match(s.text(),/失敗しました/);
  broken=false;await s.click('思い出せた');const saves=s.calls.filter(Array.isArray);assert.equal(saves[0][5],saves[1][5]);assert.match(s.text(),/2 \/ 2問/);await s.close();
});
test('daily answer double click locks first choice and stale rating cannot save next item',async()=>{
  const s=await setup();await s.click('今日の20問');
  const buttons=s.renderer.root.findAllByType('button');
  const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
  const a=buttons.find(b=>text(b).startsWith('A.')),b=buttons.find(b=>text(b).startsWith('B.'));
  await act(async()=>{await a.props.onClick();await b.props.onClick();});
  const rate=s.renderer.root.findAllByType('button').find(b=>text(b).includes('思い出せた'));
  const staleClick=rate.props.onClick;
  await act(async()=>staleClick());
  await act(async()=>staleClick());
  const saves=s.calls.filter(Array.isArray);assert.equal(saves.length,1);assert.equal(saves[0][2],'a');await s.close();
});
test('daily last-item save failure stays answered until successful retry',async()=>{
  const s=await setup({dailyQuestions:[q('q1')]});await s.click('今日の20問');await s.clickChoice('b');s.fail(true);
  await s.click('思い出せない');assert.ok(!s.text().includes('お疲れさまでした'));assert.match(s.text(),/失敗しました/);
  s.fail(false);await s.click('思い出せない');assert.match(s.text(),/完了：1 \/ 1問/);assert.match(s.text(),/正解 0 \/ 回答済み 1問/);await s.close();
});
test('daily two-choice answers survive rapid clicks and save exactly once',async()=>{
  const s=await setup({dailyQuestions:[{...q('q1'),answer:'ab'}]});await s.click('今日の20問');
  const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
  const buttons=s.renderer.root.findAllByType('button'),a=buttons.find(b=>text(b).startsWith('A.')).props.onClick,b=buttons.find(b=>text(b).startsWith('B.')).props.onClick;
  await act(async()=>{a();b();a();});assert.match(s.text(),/✓ 正解/);
  await s.click('思い出せた');assert.equal(s.calls.filter(Array.isArray).length,1);assert.equal(s.calls.filter(Array.isArray)[0][2],'ab');await s.close();
});
test('daily JST midnight creates a new local session without erasing yesterday',async()=>{
  const storage=new Map();let s=await setup({storage,now:()=>Date.parse('2026-10-03T14:59:59Z')});await s.click('今日の20問');await s.close();
  s=await setup({storage,now:()=>Date.parse('2026-10-03T15:00:00Z')});assert.match(s.text(),/始める/);await s.click('今日の20問');
  assert.equal(storage.size,4);assert.ok([...storage.keys()].some(k=>k.endsWith('2026-10-03')));assert.ok([...storage.keys()].some(k=>k.endsWith('2026-10-04')));await s.close();
});
test('daily home refreshes its label at JST midnight without fetching candidates',async()=>{
  let now=Date.parse('2026-10-03T14:59:59Z'),tick;
  const s=await setup({now:()=>now,browser:{setTimeout:cb=>{tick=cb;return 1},clearTimeout:()=>{}}});
  await s.click('今日の20問');await s.click('← ホーム');assert.match(s.text(),/続きから/);
  now=Date.parse('2026-10-03T15:00:00Z');await act(async()=>tick());assert.match(s.text(),/始める/);
  assert.equal(s.calls.filter(x=>x==='daily-load').length,1);await s.close();
});
test('daily unlimited small-bank sets reuse safely with different attempt IDs',async()=>{
  const s=await setup({dailyQuestions:[q('q1')]});
  for(let set=0;set<5;set++){
    await s.click('今日の20問');assert.match(s.text(),/1 \/ 1問/);
    await s.clickChoice('a');await s.click('思い出せた');assert.match(s.text(),/完了：1 \/ 1問/);
    await s.click('ホームに戻る');assert.match(s.text(),/次の20問/);
  }
  const saves=s.calls.filter(Array.isArray);assert.equal(saves.length,5);assert.equal(new Set(saves.map(c=>c[5])).size,5);
  assert.equal(s.calls.filter(c=>c==='daily-load').length,5);
  assert.equal(s.storage.size,2); // current set + daily ID history, not unlimited per-set documents
  await s.close();
});
test('daily second-set double start, failed save and reload preserve set identity',async()=>{
  const storage=new Map();let s=await setup({storage,dailyQuestions:[q('q1')]});
  await s.click('今日の20問');await s.clickChoice('a');await s.click('思い出せた');
  const first=readDailySession(storage);await s.click('ホームに戻る');
  const start=s.renderer.root.findAllByType('button').find(b=>String(b.children).includes('今日の20問')).props.onClick;
  await act(async()=>Promise.all([start(),start()]));
  const second=readDailySession(storage);assert.notEqual(first.token,second.token);assert.equal(s.calls.filter(c=>c==='daily-load').length,2);
  await s.clickChoice('b');s.fail(true);await s.click('思い出せない');
  const failed=s.calls.filter(Array.isArray).at(-1);assert.equal(readDailySession(storage).done.length,0);await s.close();
  s=await setup({storage,dailyQuestions:[q('q1')]});assert.match(s.text(),/続きから/);await s.click('今日の20問');
  assert.equal(readDailySession(storage).token,second.token);await s.clickChoice('b');await s.click('思い出せない');
  assert.equal(s.calls.filter(Array.isArray)[0][5],failed[5]);assert.match(s.text(),/完了：1 \/ 1問/);await s.close();
});
test('daily active set crossing midnight saves to its original date then starts a fresh day',async()=>{
  let now=Date.parse('2026-10-03T14:59:59Z');const storage=new Map();
  const s=await setup({storage,now:()=>now,dailyQuestions:[q('q1'),q('q2')]});await s.click('今日の20問');
  const original=readDailySession(storage);await s.clickChoice('a');now=Date.parse('2026-10-03T15:00:00Z');
  await s.click('今日はここまで');await s.click('思い出せた');
  assert.equal(readDailySession(storage).date,'2026-10-03');assert.match(s.calls.filter(Array.isArray)[0][5],/daily-2026-10-03-/);
  await s.click('ホームに戻る');assert.match(s.text(),/始める/);await s.click('今日の20問');
  const today=readDailySession(storage);assert.equal(today.date,'2026-10-04');assert.notEqual(today.token,original.token);
  const yesterday=JSON.parse([...storage.entries()].find(([k])=>k.endsWith('2026-10-03'))[1]);assert.equal(yesterday.done.length,1);await s.close();
});
test('daily home contains one daily entry and no old ten-question or assessment menu',async()=>{
  const s=await setup();const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
  assert.equal(s.renderer.root.findAllByType('button').filter(b=>text(b).includes('今日の20問')).length,1);
  assert.ok(!s.text().includes('今日の10問'));assert.ok(!s.text().includes('能力認定'));assert.ok(!s.text().includes('評価メニュー'));
  await s.close();
});
test('daily stale rating from earlier set cannot answer reused question in new set',async()=>{
  const s=await setup({dailyQuestions:[q('q1')]});await s.click('今日の20問');await s.clickChoice('a');
  const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
  const oldRating=s.renderer.root.findAllByType('button').find(b=>text(b).includes('思い出せた')).props.onClick;
  await act(async()=>oldRating());await s.click('ホームに戻る');await s.click('今日の20問');
  await act(async()=>oldRating());assert.equal(s.calls.filter(Array.isArray).length,1);assert.equal(readDailySession(s.storage).done.length,0);
  await s.clickChoice('b');await s.click('思い出せない');assert.equal(s.calls.filter(Array.isArray).length,2);assert.match(s.text(),/正解 0/);await s.close();
});
test('daily home keeps brief description and collapsed resumption details',async()=>{
  const s=await setup();const details=s.renderer.root.findByType('details');
  assert.ok(!details.props.open);
  assert.equal(details.findByType('summary').children.join(''),'再開について');
  assert.match(s.text(),/未回答・復習・最近間違えた問題から、分野の偏りを抑えて出題。1日何回でも。/);
  const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
  assert.match(text(details),/端末間同期なし/);assert.match(text(details),/日本時間/);assert.ok(!s.text().includes('苦手'));
  await s.close();
});
test('daily completed summary starts next set directly and guards double click',async()=>{
  const s=await setup({dailyQuestions:[q('q1')]});await s.click('今日の20問');await s.clickChoice('a');await s.click('思い出せた');
  const first=readDailySession(s.storage);assert.match(s.text(),/ホームに戻る/);
  const next=s.renderer.root.findAllByType('button').find(b=>b.children.join('')==='次の20問').props.onClick;
  await act(async()=>Promise.all([next(),next()]));
  assert.notEqual(readDailySession(s.storage).token,first.token);assert.match(s.text(),/1 \/ 1問/);
  assert.equal(s.calls.filter(c=>c==='daily-load').length,2);assert.equal(s.calls.filter(Array.isArray).length,1);await s.close();
});
test('daily partial summary resumes same set directly without another candidate load',async()=>{
  const s=await setup();await s.click('今日の20問');await s.clickChoice('a');await s.click('今日はここまで');await s.click('思い出せた');
  const partial=readDailySession(s.storage);assert.match(s.text(),/途中保存：1 \/ 2問/);assert.match(s.text(),/ホームに戻る/);
  await s.click('続きから');assert.match(s.text(),/2 \/ 2問/);assert.equal(readDailySession(s.storage).token,partial.token);
  assert.equal(s.calls.filter(c=>c==='daily-load').length,1);await s.close();
});
test("review follows queue and finishes without random questions", async () => {
  const s = await setup();
  await s.click("復習モード");
  await s.click("復習を開始");
  assert.match(s.text(), /問題 q1/);
  await s.click("選択肢A");
  await s.click("思い出せた");
  assert.match(s.text(), /問題 q2/);
  await s.click("選択肢A");
  await s.click("思い出せた");
  assert.match(s.text(), /お疲れさまでした/);
  assert.equal(s.calls.includes("random"), false);
  assert.deepEqual(
    s.calls.map((c) => c[1]),
    ["q1", "q2"],
  );
  await s.close();
});
test("finish waits for rating and saves last answer before summary", async () => {
  const s = await setup();
  await s.click("クイズ");
  await s.click("選択肢A");
  await s.click("今日はここまで");
  assert.match(s.text(), /この回答を保存して終了/);
  await s.click("思い出せた");
  assert.equal(s.calls.filter(Array.isArray).length, 1);
  assert.match(s.text(), /お疲れさまでした/);
  await s.close();
});
test("failed saving stays on same review question and retries with same attempt ID", async () => {
  const s = await setup();
  await s.click("復習モード");
  await s.click("復習を開始");
  await s.click("選択肢A");
  s.fail(true);
  await s.click("思い出せた");
  assert.match(s.text(), /失敗しました/);
  assert.match(s.text(), /問題 q1/);
  s.fail(false);
  await s.click("思い出せた");
  const saves = s.calls.filter(Array.isArray);
  assert.equal(saves[0][5], saves[1][5]);
  assert.match(s.text(), /問題 q2/);
  await s.close();
});
test("attempt retry only updates SRS once and failed transaction saves nothing", async () => {
  const store = new Map();
  let fail = false;
  const timestamp = (d) => ({ toDate: () => d });
  const api = {
    doc: (...args) => args.filter((x) => typeof x === "string").join("/"),
    collection: (...args) =>
      args.filter((x) => typeof x === "string").join("/"),
    Timestamp: { fromDate: timestamp },
    runTransaction: async (_, fn) => {
      const staged = [];
      const res = await fn({
        get: async (path) => ({
          exists: () => store.has(path),
          data: () => store.get(path),
        }),
        set: (path, data) => staged.push([path, data]),
      });
      if (fail) throw Error("offline");
      for (const [p, d] of staged) store.set(p, d);
      return res;
    },
  };
  let schedules = 0;
  const { saveAttempt } = load("src/lib/firebaseHelpers.ts", {
    "firebase/firestore": api,
    "firebase/auth": {},
    "firebase/functions": {},
    "./firebase": { db: {} },
    "./srs": {
      scheduleCard: () => {
        schedules++;
        return { nextCard: {}, nextDue: new Date() };
      },
    },
  });
  fail = true;
  await assert.rejects(saveAttempt("u", "q1", "a", "a", "good", "a1"));
  assert.equal(store.size, 0);
  fail = false;
  await saveAttempt("u", "q1", "a", "a", "good", "a1");
  const before = schedules;
  await saveAttempt("u", "q1", "a", "a", "good", "a1");
  assert.equal(schedules, before);
  assert.equal(store.size, 2);
});
test("Functions reject forged admins and preserve muro as sole administrator", async () => {
  let created = 0;
  const admin = {
    initializeApp() {},
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({ role: "admin" }) }),
          set: async () => {},
        }),
      }),
    }),
    auth: () => ({
      createUser: async () => {
        created++;
        return { uid: "new" };
      },
      updateUser: async () => {},
    }),
  };
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const functions = load("functions/index.js", {
    "firebase-admin": admin,
    "firebase-functions/v2/https": { onCall: (fn) => fn, HttpsError },
  });
  await assert.rejects(
    functions.adminCreateUser({
      auth: { uid: "member" },
      data: { username: "someone", password: "test123", role: "user" },
    }),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    functions.changeUserPassword({
      auth: { uid: "member" },
      data: { targetUid: "other", newPassword: "test123" },
    }),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    functions.adminCreateUser({
      auth: { uid: "kuredXmbTWhCfx4dVtvdUyiZsUq1" },
      data: { username: "someone", password: "test123", role: "admin" },
    }),
    (e) => e.code === "invalid-argument",
  );
  assert.equal(created, 0);
  assert.equal(
    (
      await functions.adminCreateUser({
        auth: { uid: "kuredXmbTWhCfx4dVtvdUyiZsUq1" },
        data: { username: "someone", password: "test123", role: "user" },
      })
    ).success,
    true,
  );
});
test("home after answering also requests saving rather than dropping answer", async () => {
  const s = await setup();
  await s.click("クイズ");
  await s.click("選択肢A");
  await s.click("← ホーム");
  assert.match(s.text(), /この回答を保存して終了/);
  await s.click("思い出せた");
  assert.equal(s.calls.filter(Array.isArray).length, 1);
  assert.match(s.text(), /お疲れさまでした/);
  await s.close();
});
test("screen markup matches original unaffected screens and reviewed answer panel baseline", async () => {
  const hashes = {};
  const crypto = require("node:crypto");
  const snap = (s, name) => {
    hashes[name] = crypto
      .createHash("sha256")
      .update(JSON.stringify(s.renderer.toJSON()))
      .digest("hex");
  };
  let s = await setup();
  snap(s, "home");
  await s.click("設定");
  snap(s, "settings");
  await s.click("2025a");
  await s.click("気道管理");
  snap(s, "filters");
  await s.click("← ホーム");
  await s.click("成績確認");
  snap(s, "stats");
  await s.click("← ホーム");
  await s.click("復習モード");
  snap(s, "review-list");
  await s.click("復習を開始");
  snap(s, "review-question");
  await s.click("選択肢A");
  snap(s, "answered");
  await s.click("解説を見る");
  snap(s, "explanation");
  await s.click("×");
  await s.click("今日はここまで");
  snap(s, "finish-prompt");
  await s.click("思い出せた");
  snap(s, "summary");
  await s.click("ホームに戻る");
  await s.click("試験モード");
  snap(s, "exam-select");
  await s.click("2025年度");
  snap(s, "exam-question");
  await s.click("← ホーム");
  snap(s, "exam-warning");
  await s.click("続ける");
  await s.click("選択肢A");
  snap(s, "exam-answered");
  await s.click("結果を見る");
  snap(s, "exam-transition");
  await s.click("B問題へ進む");
  snap(s, "exam-b");
  await s.click("選択肢B");
  await s.click("結果を見る");
  snap(s, "exam-result");
  assert.equal(s.calls.find((c) => c[0] === "exam")[1].score, 50);
  await s.click("履歴を見る");
  snap(s, "exam-history");
  await s.close();
  s = await setup({ admin: true });
  snap(s, "admin-home");
  await s.click("管理者パネル");
  snap(s, "admin-panel");
  await s.click("PW変更");
  snap(s, "password-panel");
  await s.close();
  s = await setup({ empty: true });
  await s.click("クイズ");
  snap(s, "empty");
  await s.close();
  s = await setup({ multi: true });
  await s.click("クイズ");
  await s.click("選択肢A");
  snap(s, "multi-selected");
  await s.click("選択肢B");
  snap(s, "multi-answered");
  await s.close();
  // Preserve the original refactor baseline for screens outside this UI change.
  const changed = [
    "review-question",
    "answered",
    "explanation",
    "finish-prompt",
    "exam-question",
    "exam-warning",
    "exam-answered",
    "exam-b",
    "multi-selected",
    "multi-answered",
  ];
  if (process.env.RECORD_ANSWER_PANEL_BASELINE === "1") {
    fs.writeFileSync(
      "tests/answer-panel-baseline.json",
      JSON.stringify(
        Object.fromEntries(changed.map((name) => [name, hashes[name]])),
        null,
        2,
      ) + "\n",
    );
  }
  const updated = JSON.parse(
    fs.readFileSync("tests/answer-panel-baseline.json"),
  );
  assert.deepEqual(Object.keys(updated).sort(), [...changed].sort());
  // User-requested learning/annual-count screens and overlays with the changed
  // home beneath them are replaced. Admin/password components are unchanged.
  // Preserve both previous baselines for every other state.
  const learningChanged = ["home", "admin-home", "admin-panel", "password-panel", "stats", "exam-select"];
  if (process.env.RECORD_LEARNING_BASELINE === "1") {
    fs.writeFileSync("tests/learning-screen-baseline.json", JSON.stringify(
      Object.fromEntries(learningChanged.map(name => [name, hashes[name]])), null, 2) + "\n");
  }
  const learningUpdated = JSON.parse(fs.readFileSync("tests/learning-screen-baseline.json"));
  assert.deepEqual(Object.keys(learningUpdated).sort(), [...learningChanged].sort());
  assert.deepEqual(hashes, {
    ...JSON.parse(fs.readFileSync("tests/screen-baseline.json")),
    ...updated,
    ...learningUpdated,
  });
});

test("each recall choice saves the matching rating and advances even after an incorrect answer", async () => {
  for (const [label, rating] of [
    ["思い出せない", "again"],
    ["迷った", "hard"],
    ["思い出せた", "good"],
    ["余裕で分かった", "easy"],
  ]) {
    const s = await setup();
    await s.click("復習モード");
    await s.click("復習を開始");
    assert.equal(
      s.renderer.root.findAllByProps({ "aria-label": "回答結果と次の操作" })
        .length,
      0,
    );
    await s.click("選択肢B");
    assert.match(s.text(), /不正解/);
    assert.match(s.text(), /正答：A/);
    assert.match(s.text(), /回答を保存して次へ/);
    const dock = s.renderer.root.findByProps({
      "aria-label": "回答結果と次の操作",
    });
    assert.equal(dock.props.style.flexShrink, 0);
    const scroll = s.renderer.root.findByProps({
      "aria-label": "問題と選択肢",
    });
    assert.equal(scroll.props.style.overflowY, "auto");
    assert.equal(
      scroll.findAllByProps({ "aria-label": "回答結果と次の操作" }).length,
      0,
    );
    await s.click(label);
    assert.equal(s.calls.filter(Array.isArray)[0][4], rating);
    assert.match(s.text(), /問題 q2/);
    await s.close();
  }
});

test("ending can be cancelled; opening and closing explanation never saves an answer", async () => {
  const s = await setup();
  await s.click("復習モード");
  await s.click("復習を開始");
  await s.click("選択肢A");
  await s.click("今日はここまで");
  assert.match(s.text(), /この回答を保存して終了/);
  await s.click("解説を見る");
  assert.equal(s.renderer.root.findAllByProps({ role: "dialog" }).length, 1);
  await s.click("×");
  assert.equal(s.calls.filter(Array.isArray).length, 0);
  await s.click("終了をやめて、続ける");
  await s.click("思い出せた");
  assert.match(s.text(), /問題 q2/);
  assert.equal(s.calls.filter(Array.isArray).length, 1);
  await s.close();
});

test("scanned question preserves line breaks, figure, combination answer and explanation without saving on reveal", async () => {
  const question={...q('scan1'),id:'2015a-44',year:'2015a',qnum:44,
    stem:'テスト専用設問\n（1）第一の記述\n（2）第二の記述',
    choices:{a:'（1）、（2）',b:'（1）、（3）',c:'（2）、（3）',d:'（2）、（3）、（4）',e:'（3）、（4）、（5）'},
    answer:'d',category:'CE関連',is_image_question:true,main_image:'q44-test.png',
    explanation:'独自解説のテスト\n出題当時と現在の違い'};
  const s=await setup({question,years:['2015a','2015b']});
  await s.click('クイズ');
  assert.match(s.text(),/2015a Q44/);
  assert.ok(s.renderer.root.findAllByType('span').some(n=>n.props.style?.whiteSpace==='pre-wrap' && n.children.includes(question.stem)));
  assert.equal(s.renderer.root.findByType('img').props.src,'/quiz-images/2015a/q44-test.png');
  await s.click('（2）、（3）、（4）');
  assert.match(s.text(),/✓ 正解/);
  await s.click('解説を見る');
  assert.match(s.text(),/出題当時と現在の違い/);
  assert.equal(s.calls.filter(Array.isArray).length,0);
  await s.click('×');
  await s.click('思い出せた');
  const saved=s.calls.filter(Array.isArray)[0];
  assert.equal(saved[1],'2015a-44');assert.equal(saved[2],'d');
  await s.close();
});

test('historical exam preserves skipped numbers and scores only the available questions',async()=>{
 const old=(part,n)=>({...q('q'+n),id:`2015${part}-${n}`,year:`2015${part}`,qnum:n});
 const s=await setup({years:['2015a','2015b'],examQuestions:{'2015a':[old('a',35),old('a',42)],'2015b':[old('b',60)]}});
 await s.click('試験モード');
 assert.match(s.text(),/原本の欠番・確認待ちの問題を除いて/);
 assert.match(s.text(),/A問題 46問・B問題 52問/);
 await s.click('2015年度');
 assert.match(s.text(),/Q35/);
 await s.click('選択肢A');await s.click('次の問題');
 assert.match(s.text(),/Q42/);
 await s.click('選択肢B');await s.click('結果を見る');await s.click('B問題へ進む');
 assert.match(s.text(),/Q60/);
 await s.click('選択肢A');await s.click('結果を見る');
 const result=s.calls.find(c=>Array.isArray(c)&&c[0]==='exam')[1];
 assert.equal(result.totalQuestions,3);assert.equal(result.correctAnswers,2);assert.equal(result.score,67);
 assert.deepEqual(Array.from(result.answers,a=>a.questionId),['2015a-35','2015a-42','2015b-60']);
 await s.close();
});

test('every approved scanned question completes display, correct response, explanation and mock save', {skip:!process.env.SCAN_REVIEW_BUNDLE},async()=>{
 const bundle=JSON.parse(fs.readFileSync(process.env.SCAN_REVIEW_BUNDLE));
 const {validateScanImport}=await import('../scripts/scan-import-validation.mjs');
 const questions=validateScanImport(bundle);
 for(const row of questions){
  const s=await setup({question:{id:row.id,...row.data},years:[row.data.year]});
  try{
   await s.click('クイズ');
   assert.ok(s.text().includes(row.data.stem),row.id+' stem');
   if(row.data.is_image_question){
    assert.equal(s.renderer.root.findByType('img').props.src,`/quiz-images/${row.data.year}/${row.data.main_image}`,row.id+' figure');
   }
   for(const choice of row.data.answer)await s.clickChoice(choice);
   assert.match(s.text(),/✓ 正解/,row.id);
   await s.click('解説を見る');
   assert.ok(s.text().includes(row.data.explanation),row.id+' explanation');
   assert.equal(s.calls.filter(Array.isArray).length,0);
   await s.click('×');await s.click('思い出せた');
   const saved=s.calls.filter(Array.isArray);
   assert.equal(saved.length,1,row.id+' save count');
   assert.equal(saved[0][1],row.id);assert.equal(saved[0][2],row.data.answer);
  } finally {await s.close();}
 }
});
