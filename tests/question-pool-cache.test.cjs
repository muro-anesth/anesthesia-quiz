const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Actual helper/cache code with an in-memory Firestore double. No Firebase SDK,
// credentials, network access or production data is used by these tests.
function fixture({ browser = true } = {}) {
  let now = 1000, fail = false, gate;
  const auth = { currentUser: { uid: 'alice' } };
  const reads = [], writes = [], modules = new Map(), store = new Map();
  const questions = [
    { id: 'a', year: '2025a', category: '気道管理', answer: 'a', stem: 'A', choices: { a: 'A' } },
    { id: 'b', year: '2025a', category: 'CE関連', answer: 'b', stem: 'B', choices: { a: 'B' } },
    { id: 'c', year: '2024b', category: '気道管理', answer: 'c', stem: 'C', choices: { a: 'C' } },
  ];
  const snapshot = rows => ({ docs: rows.map(({ id, ...data }) => ({ id, data: () => structuredClone(data) })) });
  const firestore = {
    collection: (_, ...parts) => parts.join('/'),
    doc: (_, ...parts) => parts.join('/'),
    query: (ref, ...clauses) => ({ path: ref.path ?? ref, clauses: [...(ref.clauses ?? []), ...clauses] }),
    where: (field, op, value) => ({ field, op, value }),
    orderBy: field => ({ order: field }),
    Timestamp: { now: () => now, fromDate: date => date },
    async getDocs(ref) {
      const name = ref.path ?? ref;
      reads.push(name);
      if (name !== 'questions') return snapshot(store.get(name) ?? []);
      if (gate) await gate;
      if (fail) throw Error('offline');
      const year = ref.clauses?.find(c => c.field === 'year');
      return snapshot(questions.filter(q => !year || year.value.includes(q.year)));
    },
    async getDoc(ref) {
      reads.push(ref);
      const row = ref.startsWith('questions/')
        ? questions.find(q => q.id === ref.split('/')[1]) : store.get(ref);
      return { exists: () => !!row, data: () => structuredClone(row) };
    },
    async setDoc(ref, data) { writes.push(ref); store.set(ref, structuredClone(data)); },
    serverTimestamp: () => now,
    async runTransaction(_, fn) {
      return fn({ get: firestore.getDoc, set: (ref, data) => { writes.push(ref); store.set(ref, data); } });
    },
  };
  class Clock extends Date { static now() { return now; } }
  const mocks = {
    './firebase': { default: {}, auth, db: {} },
    './srs': { scheduleCard: () => ({ nextCard: {}, nextDue: new Date(now) }) },
    'firebase/firestore': firestore, 'firebase/auth': {}, 'firebase/functions': {},
  };
  function load(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file);
    if (file.endsWith('.json')) return { default: JSON.parse(fs.readFileSync(file, 'utf8')) };
    const exports = {};
    modules.set(file, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      exports, Date: Clock, Math: Object.assign(Object.create(Math), { random: () => 0 }),
      structuredClone, ...(browser ? { window: {} } : {}),
      require(id) {
        if (id in mocks) return mocks[id];
        if (!id.startsWith('.')) throw Error('Unmocked dependency: ' + id);
        const base = path.resolve(path.dirname(file), id);
        return load([base, base + '.ts', base + '.json'].find(f => fs.existsSync(f) && fs.statSync(f).isFile()));
      },
    });
    return exports;
  }
  return {
    api: load('src/lib/firebaseHelpers.ts'), stars: load('src/lib/questionStars.ts'),
    cache: load('src/lib/questionPoolCache.ts'), auth, questions, reads, writes, store,
    setTime: value => { now = value; }, fail: value => { fail = value; },
    block() { gate = new Promise(resolve => { this.release = () => { gate = undefined; resolve(); }; }); },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('normal questions reuse one pool but apply current exclusions and cycle/empty behavior each time', async () => {
  const f = fixture();
  assert.equal((await f.api.getNextQuestion([], [], [])).question.id, 'a');
  assert.equal((await f.api.getNextQuestion([], [], ['a'])).question.id, 'b');
  const cycle = await f.api.getNextQuestion([], [], ['a', 'b', 'c']);
  assert.equal(cycle.cycleComplete, true);
  assert.equal(cycle.question.id, 'a');
  for (let i = 0; i < 20; i++) await f.api.getNextQuestion([], [], ['a', 'b']);
  assert.equal(f.reads.filter(r => r === 'questions').length, 1);
  assert.equal((await f.api.getNextQuestion(['2099a'], [], [])).mode, 'empty');
  assert.equal(f.writes.length, 0);
});

test('year/category sets have separate keys; reordered/duplicate conditions reuse the same pool', async () => {
  const f = fixture();
  const years = ['2025a', '2024b'], categories = ['気道管理', 'CE関連'];
  await f.api.getNextQuestion(years, categories, []);
  await f.api.getNextQuestion(['2024b', '2025a', '2025a'], ['CE関連', '気道管理'], []);
  assert.equal(f.reads.length, 1);
  assert.equal((await f.api.getNextQuestion(['2025a'], ['CE関連'], [])).question.id, 'b');
  assert.equal((await f.api.getNextQuestion(['2024b'], ['気道管理'], [])).question.id, 'c');
  assert.equal((await f.api.getNextQuestion(['2025a'], ['気道管理'], [])).question.id, 'a');
  assert.deepEqual(years, ['2025a', '2024b']);
  assert.deepEqual(categories, ['気道管理', 'CE関連']);
  assert.equal(f.reads.length, 4);
});

test('concurrent normal selections share the fetch and keep their own exclusion lists', async () => {
  const f = fixture(); f.block();
  const one = f.api.getNextQuestion([], [], []);
  const two = f.api.getNextQuestion([], [], ['a']);
  await tick(); assert.equal(f.reads.length, 1);
  f.release();
  assert.equal((await one).question.id, 'a');
  assert.equal((await two).question.id, 'b');
});

test('failed in-flight reads reject all callers, then retry instead of caching a failure', async () => {
  const f = fixture(); f.fail(true);
  const results = await Promise.allSettled([f.api.getNextQuestion([], [], []), f.api.getNextQuestion([], [], [])]);
  assert.ok(results.every(r => r.status === 'rejected'));
  assert.equal(f.reads.length, 1);
  f.fail(false);
  assert.equal((await f.api.getNextQuestion([], [], [])).question.id, 'a');
  assert.equal(f.reads.length, 2);
});

test('TTL is five minutes from successful completion, never extended by cache hits', async () => {
  const f = fixture(); f.block();
  const pending = f.api.getNextQuestion([], [], []);
  await tick(); f.setTime(1000000); f.release(); await pending;
  f.questions[0].stem = 'edited';
  f.setTime(1000000 + f.cache.QUESTION_POOL_TTL_MS - 1);
  assert.equal((await f.api.getNextQuestion([], [], [])).question.stem, 'A');
  f.setTime(1000000 + f.cache.QUESTION_POOL_TTL_MS);
  assert.equal((await f.api.getNextQuestion([], [], [])).question.stem, 'edited');
  assert.equal(f.reads.length, 2);
});

test('explicit invalidation refreshes edited data and prevents old in-flight reads reseeding the cache', async () => {
  const f = fixture();
  await f.api.getNextQuestion([], [], []);
  f.questions[0].stem = 'edited'; f.api.invalidateQuestionPoolCache();
  assert.equal((await f.api.getNextQuestion([], [], [])).question.stem, 'edited');
  const cache = f.cache.createQuestionPoolCache();
  let release;
  const old = cache.get([], [], () => new Promise(resolve => { release = resolve; }));
  await tick(); cache.invalidate();
  assert.equal((await cache.get([], [], async () => ['new']))[0], 'new');
  release(['old']); await old;
  assert.equal((await cache.get([], [], async () => ['unexpected']))[0], 'new');
  // An old failure must not evict the replacement either.
  cache.invalidate(); let reject;
  const failed = cache.get([], [], () => new Promise((_, no) => { reject = no; }));
  await tick(); cache.invalidate(); await cache.get([], [], async () => ['replacement']);
  reject(Error('old failure')); await assert.rejects(failed);
  assert.equal((await cache.get([], [], async () => ['unexpected']))[0], 'replacement');
});

test('raw fetchQuestions remains fresh; mutating the selected question cannot corrupt the cached pool', async () => {
  const f = fixture();
  const first = await f.api.getNextQuestion([], [], []);
  first.question.choices.a = 'caller mutation'; first.question.stem = 'caller mutation';
  assert.equal((await f.api.getNextQuestion([], [], [])).question.choices.a, 'A');
  f.questions[0].stem = 'external edit';
  assert.equal((await f.api.fetchQuestions([], []))[0].stem, 'external edit');
  await f.api.fetchQuestions([], []);
  assert.equal(f.reads.length, 3);
});

test('anonymous and server calls cannot use an authenticated browser cache', async () => {
  const f = fixture(); await f.api.getNextQuestion([], [], []);
  f.auth.currentUser = null; f.fail(true);
  await assert.rejects(f.api.getNextQuestion([], [], []));
  await assert.rejects(f.api.getNextQuestion([], [], []));
  assert.equal(f.reads.length, 3);
  const server = fixture({ browser: false });
  await server.api.getNextQuestion([], [], []); await server.api.getNextQuestion([], [], []);
  assert.equal(server.reads.length, 2);
});

test('only public questions cross UIDs: attempts, progress and stars stay fresh and owner-scoped', async () => {
  const f = fixture();
  await f.api.getNextQuestion([], [], ['a']);
  await f.api.saveAttempt('alice', 'a', 'a', 'a', 'good', 'attempt-a');
  await f.api.getNextQuestion([], [], ['a']);
  f.store.set('users/alice/progress', [{ id: 'a' }]);
  assert.equal((await f.api.getReviewQueue('alice')).total, 1);
  f.store.set('users/alice/progress', []);
  assert.equal((await f.api.getReviewQueue('alice')).total, 0);
  f.store.set('users/alice/questionStars', [{ id: 'a', starred: true }]);
  assert.equal((await f.stars.getQuestionStars('alice')).length, 1);
  f.store.set('users/alice/questionStars', []);
  assert.equal((await f.stars.getQuestionStars('alice')).length, 0);
  f.auth.currentUser = { uid: 'bob' };
  assert.equal((await f.api.getNextQuestion([], [], [])).question.id, 'a');
  assert.equal((await f.api.getReviewQueue('bob')).total, 0);
  assert.equal((await f.stars.getQuestionStars('bob')).length, 0);
  await assert.rejects(f.stars.getQuestionStars('alice'));
  assert.equal(f.reads.filter(r => r === 'questions').length, 1);
  assert.equal(f.reads.filter(r => r === 'users/alice/progress').length, 2);
  assert.equal(f.reads.filter(r => r === 'users/alice/questionStars').length, 2);
  assert.ok(f.writes.every(r => r.startsWith('users/alice/')));
});

test('cache bounds retained query pools and snapshots conditions before asynchronous loading', async () => {
  const f = fixture(); const cache = f.cache.createQuestionPoolCache(); let reads = 0;
  for (let i = 0; i < 17; i++) await cache.get([String(i)], [], async () => { reads++; return [i]; });
  await cache.get(['0'], [], async () => { reads++; return [0]; });
  assert.equal(reads, 18);
  const years = ['2025a'], categories = ['気道管理'];
  const pending = f.api.getNextQuestion(years, categories, []);
  years[0] = '2024b'; categories[0] = 'CE関連';
  assert.equal((await pending).question.id, 'a');
});
